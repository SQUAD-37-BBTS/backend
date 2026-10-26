import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/decorators.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { exigirPapelNoAtivo } from './ativo-permissoes.js';
import type {
  CriarDecisaoDto,
  CriarPapelDto,
  SalvarContextualizacaoDto,
  SalvarEnquadramentoDto,
} from './ativos.dto.js';

const PESSOA_RESUMO = {
  select: { id: true, nome: true, email: true },
} as const;

const ORIGENS_VALIDAS = ['usuario', 'ia'];

/** `origens` registra se cada resposta veio do usuário ou de sugestão de IA. */
function validarOrigens(origens: unknown) {
  if (origens === undefined) return;
  const valido =
    typeof origens === 'object' &&
    origens !== null &&
    !Array.isArray(origens) &&
    Object.values(origens).every((o) => ORIGENS_VALIDAS.includes(o as string));
  if (!valido) {
    throw new BadRequestException(
      "origens deve mapear cada resposta para 'usuario' ou 'ia'",
    );
  }
}

/** Sub-recursos de um ativo: papéis, avaliação, enquadramento e decisões. */
@Injectable()
export class AtivoDetalhesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ---------- Papéis

  async listarPapeis(ativoId: string) {
    await this.garantirAtivo(ativoId);
    return this.prisma.papel_ativo.findMany({
      where: { ativo_id: ativoId },
      include: { pessoa: PESSOA_RESUMO },
      orderBy: { tipo_papel: 'asc' },
    });
  }

  /** Só o Owner do ativo (ou Admin) gerencia papéis. */
  adicionarPapel(
    ativoId: string,
    dto: CriarPapelDto,
    usuario: UsuarioAutenticado,
  ) {
    const usuarioId = usuario.id;
    return this.prisma.$transaction(async (tx) => {
      await exigirPapelNoAtivo(tx, ativoId, usuario, ['Owner']);
      const novo = await tx.papel_ativo.create({
        data: { ativo_id: ativoId, ...dto },
        include: { pessoa: PESSOA_RESUMO },
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: 'papel_ativo',
        novo,
      });
      return novo;
    });
  }

  /** Remover o único Owner é permitido: o ativo passa a constar como pendência. */
  removerPapel(
    ativoId: string,
    papelId: string,
    usuario: UsuarioAutenticado,
  ) {
    const usuarioId = usuario.id;
    return this.prisma.$transaction(async (tx) => {
      await exigirPapelNoAtivo(tx, ativoId, usuario, ['Owner']);
      // where com ativo_id garante que o papel pertence ao ativo da URL.
      const antigo = await tx.papel_ativo.delete({
        where: { id: papelId, ativo_id: ativoId },
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: 'papel_ativo',
        antigo,
      });
    });
  }

  // ---------- Contextualização (questionário)

  async buscarContextualizacao(ativoId: string) {
    await this.garantirAtivo(ativoId);
    return this.prisma.contextualizacao_avaliacao.findUniqueOrThrow({
      where: { ativo_id: ativoId },
    });
  }

  salvarContextualizacao(
    ativoId: string,
    dto: SalvarContextualizacaoDto,
    usuario: UsuarioAutenticado,
  ) {
    const usuarioId = usuario.id;
    validarOrigens(dto.respostas.origens);
    const respostas = dto.respostas as Prisma.InputJsonObject;
    return this.prisma.$transaction(async (tx) => {
      await exigirPapelNoAtivo(tx, ativoId, usuario, [
        'Owner',
        'Responsavel_Tecnico',
      ]);
      const antigo = await tx.contextualizacao_avaliacao.findUnique({
        where: { ativo_id: ativoId },
      });
      const novo = await tx.contextualizacao_avaliacao.upsert({
        where: { ativo_id: ativoId },
        create: { ativo_id: ativoId, respostas },
        update: { respostas, data: new Date() },
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: 'contextualizacao_avaliacao',
        antigo: antigo ?? undefined,
        novo,
      });
      return novo;
    });
  }

  // ---------- Enquadramento

  async buscarEnquadramento(ativoId: string) {
    await this.garantirAtivo(ativoId);
    return this.prisma.motor_enquadramento.findUniqueOrThrow({
      where: { ativo_id: ativoId },
    });
  }

  // Gravação manual enquanto a regra de cálculo a partir do questionário
  // não está definida.
  salvarEnquadramento(
    ativoId: string,
    dto: SalvarEnquadramentoDto,
    usuarioId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const antigo = await tx.motor_enquadramento.findUnique({
        where: { ativo_id: ativoId },
      });
      const data = { ...dto, data_calculo: new Date() };
      const novo = await tx.motor_enquadramento.upsert({
        where: { ativo_id: ativoId },
        create: { ativo_id: ativoId, ...data },
        update: data,
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: 'motor_enquadramento',
        antigo: antigo ?? undefined,
        novo,
      });
      return novo;
    });
  }

  // ---------- Decisões (append-only; o banco bloqueia UPDATE/DELETE)

  async listarDecisoes(ativoId: string) {
    await this.garantirAtivo(ativoId);
    return this.prisma.decisao.findMany({
      where: { ativo_id: ativoId },
      include: { pessoa: PESSOA_RESUMO },
      orderBy: { data: 'desc' },
    });
  }

  /**
   * Só o Owner do ativo (ou Admin) decide; a decisão é sempre ato humano.
   * Aprovar ou aceitar risco de um ativo em Rascunho o torna Inventariado,
   * desde que o questionário já tenha sido preenchido (etapa 3 do pipeline).
   */
  registrarDecisao(
    ativoId: string,
    dto: CriarDecisaoDto,
    usuario: UsuarioAutenticado,
  ) {
    const usuarioId = usuario.id;
    return this.prisma.$transaction(async (tx) => {
      await exigirPapelNoAtivo(tx, ativoId, usuario, ['Owner']);
      const ativo = await tx.ativo.findUniqueOrThrow({
        where: { id: ativoId },
      });
      if (ativo.situacao === 'Descontinuado') {
        throw new ConflictException(
          'Ativo descontinuado não recebe novas decisões',
        );
      }

      const inventaria =
        ativo.situacao === 'Rascunho' &&
        (dto.resultado_decisao === 'Aprovado' ||
          dto.resultado_decisao === 'Risco_Aceito');
      if (inventaria) {
        const respondeu = await tx.contextualizacao_avaliacao.count({
          where: { ativo_id: ativoId },
        });
        if (!respondeu) {
          throw new ConflictException(
            'Preencha o questionário de avaliação antes de aprovar o ativo',
          );
        }
      }

      const decisao = await tx.decisao.create({
        data: { ativo_id: ativoId, responsavel_id: usuarioId, ...dto },
        include: { pessoa: PESSOA_RESUMO },
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: 'decisao',
        novo: decisao,
      });

      if (inventaria) {
        const inventariado = await tx.ativo.update({
          where: { id: ativoId },
          data: { situacao: 'Inventariado' },
        });
        await this.auditoria.registrar(tx, {
          usuarioId,
          tabela: 'ativo',
          antigo: ativo,
          novo: inventariado,
          motivo: `Decisão ${decisao.id}: ${dto.resultado_decisao}`,
        });
      }
      return decisao;
    });
  }

  /** Converte "ativo inexistente" em 404 (em vez de lista vazia). */
  private async garantirAtivo(id: string) {
    await this.prisma.ativo.findUniqueOrThrow({
      where: { id },
      select: { id: true },
    });
  }
}
