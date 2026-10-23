import { Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CriarDecisaoDto,
  CriarPapelDto,
  SalvarContextualizacaoDto,
  SalvarEnquadramentoDto,
} from './ativos.dto.js';

const PESSOA_RESUMO = {
  select: { id: true, nome: true, email: true },
} as const;

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

  adicionarPapel(ativoId: string, dto: CriarPapelDto, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
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

  removerPapel(ativoId: string, papelId: string, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
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
    usuarioId: string,
  ) {
    const respostas = dto.respostas as Prisma.InputJsonObject;
    return this.prisma.$transaction(async (tx) => {
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

  registrarDecisao(ativoId: string, dto: CriarDecisaoDto, usuarioId: string) {
    return this.prisma.decisao.create({
      data: { ativo_id: ativoId, responsavel_id: usuarioId, ...dto },
      include: { pessoa: PESSOA_RESUMO },
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
