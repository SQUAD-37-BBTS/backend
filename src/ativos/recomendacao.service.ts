import { ConflictException, Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { exigirPapelNoAtivo } from './ativo-permissoes.js';
import type { ResponderRecomendacaoDto } from './ativos.dto.js';

export interface Recomendacao {
  codigo: string;
  texto: string;
}

const PESSOA_RESUMO = {
  select: { id: true, nome: true, email: true },
} as const;

/** Tipos gravados em `decisao.tipo_decisao` ao responder uma recomendação. */
export const TIPO_RECOMENDACAO_ACEITA = 'Recomendacao_Aceita';
export const TIPO_RECOMENDACAO_REJEITADA = 'Recomendacao_Rejeitada';

/**
 * Regras que detectam informação-chave ausente no cadastro (história 2).
 * Função pura: a recomendação é sempre derivada do estado atual do ativo.
 */
export function gerarRecomendacoes(
  papeis: { tipo_papel: string }[],
  respostas: Record<string, unknown> | null,
): Recomendacao[] {
  const lista: Recomendacao[] = [];

  if (!papeis.some((p) => p.tipo_papel === 'Owner')) {
    lista.push({ codigo: 'sem_owner', texto: 'Defina um Owner para o ativo.' });
  }
  if (!respostas) {
    lista.push({
      codigo: 'sem_questionario',
      texto: 'Preencha o questionário de avaliação.',
    });
    return lista;
  }

  const usaIa = respostas.usa_ia === true;
  const automatizada = respostas.decisao_automatizada === true;
  if ((usaIa || automatizada) && respostas.supervisao_humana !== true) {
    lista.push({
      codigo: 'sem_supervisao',
      texto:
        'Avalie a necessidade de monitoramento e supervisão humana das decisões.',
    });
  }
  if (usaIa && respostas.usa_dados_pessoais === true) {
    lista.push({
      codigo: 'ia_dados_pessoais',
      texto:
        'Revise a base legal e as proteções de dados pessoais usados pela IA.',
    });
  }
  return lista;
}

export const textoDaRecomendacao = (lista: Recomendacao[]) =>
  `${lista.map((r) => r.texto).join(' ')} Faça isso antes de publicar o ativo.`;

/** Recomendações de governança: a IA sugere, a decisão final é do Owner. */
@Injectable()
export class RecomendacaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async buscar(ativoId: string) {
    const ativo = await this.prisma.ativo.findUniqueOrThrow({
      where: { id: ativoId },
      select: {
        situacao: true,
        papel_ativo: { select: { tipo_papel: true } },
        contextualizacao_avaliacao: { select: { respostas: true } },
      },
    });
    const ultima = await this.prisma.decisao.findFirst({
      where: {
        ativo_id: ativoId,
        tipo_decisao: {
          in: [TIPO_RECOMENDACAO_ACEITA, TIPO_RECOMENDACAO_REJEITADA],
        },
      },
      orderBy: { data: 'desc' },
      include: { pessoa: PESSOA_RESUMO },
    });

    const recomendacoes =
      ativo.situacao === 'Descontinuado'
        ? []
        : gerarRecomendacoes(
            ativo.papel_ativo,
            (ativo.contextualizacao_avaliacao?.respostas ?? null) as Record<
              string,
              unknown
            > | null,
          );
    return {
      recomendacoes,
      texto: recomendacoes.length ? textoDaRecomendacao(recomendacoes) : null,
      ultima_resposta: ultima,
    };
  }

  /**
   * Aceitar ou rejeitar é ato humano do Owner (ou Admin) e vira decisão
   * append-only. Não altera a situação do ativo. A recomendação é recalculada
   * no servidor; o cliente só informa a ação e a justificativa.
   */
  responder(
    ativoId: string,
    dto: ResponderRecomendacaoDto,
    usuario: UsuarioAutenticado,
  ) {
    const usuarioId = usuario.id;
    return this.prisma.$transaction(async (tx) => {
      await exigirPapelNoAtivo(tx, ativoId, usuario, ['Owner']);
      const ativo = await tx.ativo.findUniqueOrThrow({
        where: { id: ativoId },
        select: {
          situacao: true,
          papel_ativo: { select: { tipo_papel: true } },
          contextualizacao_avaliacao: { select: { respostas: true } },
        },
      });
      if (ativo.situacao === 'Descontinuado') {
        throw new ConflictException(
          'Ativo descontinuado não recebe novas decisões',
        );
      }
      const recomendacoes = gerarRecomendacoes(
        ativo.papel_ativo,
        (ativo.contextualizacao_avaliacao?.respostas ?? null) as Record<
          string,
          unknown
        > | null,
      );
      if (!recomendacoes.length) {
        throw new ConflictException('Nenhuma recomendação pendente');
      }

      const aceita = dto.acao === 'Aceitar';
      const decisao = await tx.decisao.create({
        data: {
          ativo_id: ativoId,
          responsavel_id: usuarioId,
          tipo_decisao: aceita
            ? TIPO_RECOMENDACAO_ACEITA
            : TIPO_RECOMENDACAO_REJEITADA,
          // Aceitar pede adequação; rejeitar assume o risco de não seguir.
          resultado_decisao: aceita ? 'Adequacao_Solicitada' : 'Risco_Aceito',
          justificativa: `${dto.justificativa}\n\nRecomendação: ${textoDaRecomendacao(recomendacoes)}`,
        },
        include: { pessoa: PESSOA_RESUMO },
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: 'decisao',
        novo: decisao,
        motivo: `Recomendação ${aceita ? 'aceita' : 'rejeitada'}: ${recomendacoes
          .map((r) => r.codigo)
          .join(', ')}`,
      });
      return decisao;
    });
  }
}
