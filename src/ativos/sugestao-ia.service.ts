import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { exigirPapelNoAtivo } from './ativo-permissoes.js';

/** Perguntas Sim/Não do questionário que a IA pode pré-preencher. */
export const CAMPOS_SUGERIVEIS = [
  'usa_ia',
  'usa_modelo_fundacional',
  'usa_dados_pessoais',
  'interage_com_cliente_final',
  'decisao_automatizada',
  'supervisao_humana',
] as const;

export type CampoSugerivel = (typeof CAMPOS_SUGERIVEIS)[number];
export type Sugestoes = Partial<
  Record<CampoSugerivel, { valor: boolean; justificativa: string }>
>;

const DESCRICAO_MINIMA = 30;
const FALHAS_PARA_ABRIR = 3;
const PAUSA_CIRCUITO_MS = 30_000;

const PROMPT_SISTEMA = `Você apoia a governança de ativos de dados e IA de um banco.
Com base apenas na descrição do ativo, sugira respostas Sim/Não para o questionário.
Responda somente um JSON com as chaves ${CAMPOS_SUGERIVEIS.join(', ')}.
Cada chave tem o formato {"valor": true|false, "justificativa": "uma frase curta"}.
Omita a chave quando a descrição não permitir concluir. Não invente fatos.`;

/**
 * Sugestão de preenchimento do questionário por IA (história 1).
 * A IA só sugere: nada é gravado aqui; quem confirma e salva é o usuário.
 */
@Injectable()
export class SugestaoIaService {
  private readonly logger = new Logger(SugestaoIaService.name);
  private falhasSeguidas = 0;
  private circuitoAbertoAte = 0;

  constructor(private readonly prisma: PrismaService) {}

  async sugerir(ativoId: string, usuario: UsuarioAutenticado) {
    // Transação curta só para a checagem e a leitura; a chamada à IA fica fora
    // dela para não segurar conexão do pool durante a espera.
    const ativo = await this.prisma.$transaction(async (tx) => {
      await exigirPapelNoAtivo(tx, ativoId, usuario, [
        'Owner',
        'Responsavel_Tecnico',
      ]);
      return tx.ativo.findUniqueOrThrow({
        where: { id: ativoId },
        select: {
          nome: true,
          tipo_componente: true,
          descricao: true,
          objetivo: true,
        },
      });
    });

    const descricao = (ativo.descricao ?? '').trim();
    if (descricao.length < DESCRICAO_MINIMA) {
      throw new UnprocessableEntityException(
        'Descrição insuficiente para sugestão automática — preencha manualmente',
      );
    }

    if (Date.now() < this.circuitoAbertoAte) {
      throw new BadGatewayException('Serviço de IA indisponível');
    }

    const modelo = process.env.GEMINI_MODEL ?? 'gemini-flash-lite-latest';
    try {
      // Só dados do próprio ativo seguem para a API externa (nunca pessoas).
      const bruto = await this.chamarProvedor(modelo, {
        nome: ativo.nome,
        tipo_componente: ativo.tipo_componente,
        descricao,
        objetivo: ativo.objetivo ?? undefined,
      });
      const sugestoes = this.validar(bruto);
      if (!Object.keys(sugestoes).length) {
        throw new BadGatewayException('Resposta inconsistente da IA');
      }
      this.falhasSeguidas = 0;
      return { origem: 'ia' as const, modelo, sugestoes };
    } catch (erro) {
      this.registrarFalha(erro);
      throw erro;
    }
  }

  private async chamarProvedor(modelo: string, ativo: object) {
    const chave = process.env.GEMINI_API_KEY;
    if (!chave) throw new BadGatewayException('Serviço de IA indisponível');

    const base = process.env.GEMINI_BASE_URL ??
      'https://generativelanguage.googleapis.com/v1beta';
    const timeoutMs = Number(process.env.IA_TIMEOUT_MS ?? 7_000);

    let resposta: Response;
    try {
      resposta = await fetch(`${base}/models/${modelo}:generateContent`, {
        method: 'POST',
        // A chave vai no cabeçalho (e não na URL) para não aparecer em logs.
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': chave,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: PROMPT_SISTEMA }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(ativo) }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (erro) {
      if (erro instanceof Error && erro.name === 'TimeoutError') {
        throw new GatewayTimeoutException('Serviço de IA demorou a responder');
      }
      throw new BadGatewayException('Serviço de IA indisponível');
    }
    if (!resposta.ok) {
      throw new BadGatewayException('Serviço de IA indisponível');
    }

    try {
      const corpo = (await resposta.json()) as {
        candidates?: {
          content?: { parts?: { text?: string; thought?: boolean }[] };
        }[];
      };
      // Modelos com raciocínio podem devolver partes de "pensamento" antes da resposta.
      const texto = (corpo.candidates?.[0]?.content?.parts ?? [])
        .filter((p) => !p.thought && p.text)
        .map((p) => p.text)
        .join('');
      return JSON.parse(texto) as unknown;
    } catch {
      throw new BadGatewayException('Resposta inconsistente da IA');
    }
  }

  /** Descarta chaves desconhecidas e itens fora do formato esperado. */
  private validar(bruto: unknown): Sugestoes {
    const sugestoes: Sugestoes = {};
    if (!bruto || typeof bruto !== 'object') return sugestoes;
    const objeto = bruto as Record<string, unknown>;
    for (const campo of CAMPOS_SUGERIVEIS) {
      const item = objeto[campo] as
        | { valor?: unknown; justificativa?: unknown }
        | undefined;
      if (typeof item?.valor !== 'boolean') continue;
      sugestoes[campo] = {
        valor: item.valor,
        justificativa:
          typeof item.justificativa === 'string'
            ? item.justificativa.slice(0, 300)
            : '',
      };
    }
    return sugestoes;
  }

  private registrarFalha(erro: unknown) {
    this.falhasSeguidas += 1;
    this.logger.warn(
      `Falha na IA (${this.falhasSeguidas}): ${erro instanceof Error ? erro.message : String(erro)}`,
    );
    if (this.falhasSeguidas >= FALHAS_PARA_ABRIR) {
      this.circuitoAbertoAte = Date.now() + PAUSA_CIRCUITO_MS;
      this.falhasSeguidas = 0;
    }
  }
}
