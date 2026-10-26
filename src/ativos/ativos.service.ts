import { Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import type { UsuarioAutenticado } from '../auth/decorators.js';
import { paginar } from '../common/paginacao.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { exigirPapelNoAtivo } from './ativo-permissoes.js';
import type {
  AtivosQueryDto,
  AtualizarAtivoDto,
  CriarAtivoDto,
} from './ativos.dto.js';

const TABELA = 'ativo';
const PESSOA_RESUMO = {
  select: { id: true, nome: true, email: true },
} as const;

const INCLUDE_LISTA = {
  dominio: { select: { id: true, nome: true } },
  motor_enquadramento: { select: { trilha_governanca: true } },
  papel_ativo: {
    where: { tipo_papel: { in: ['Owner', 'Steward'] } },
    select: { tipo_papel: true, pessoa: PESSOA_RESUMO },
  },
} satisfies Prisma.ativoInclude;

/** Ativo sem Owner é pendência (sinaliza, mas não bloqueia o cadastro). */
const pendenciasDe = (papeis: { tipo_papel: string }[]) =>
  papeis.some((p) => p.tipo_papel === 'Owner') ? [] : ['sem_owner'];

const comPendencias = <T extends { papel_ativo: { tipo_papel: string }[] }>(
  ativo: T,
) => ({ ...ativo, pendencias: pendenciasDe(ativo.papel_ativo) });

const INCLUDE_DETALHE = {
  dominio: { select: { id: true, nome: true } },
  papel_ativo: {
    include: { pessoa: PESSOA_RESUMO },
    orderBy: { tipo_papel: 'asc' },
  },
  motor_enquadramento: true,
  contextualizacao_avaliacao: {
    select: { id: true, data: true, updated_at: true },
  },
} satisfies Prisma.ativoInclude;

@Injectable()
export class AtivosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(q: AtivosQueryDto) {
    const where: Prisma.ativoWhereInput = {
      dominio_id: q.dominio_id,
      situacao: q.situacao,
      criticidade: q.criticidade,
      usa_cloud: q.usa_cloud,
      ...(q.pessoa_id && {
        papel_ativo: {
          some: { pessoa_id: q.pessoa_id, tipo_papel: q.tipo_papel },
        },
      }),
      ...(q.sem_owner !== undefined && {
        AND: [
          q.sem_owner
            ? { papel_ativo: { none: { tipo_papel: 'Owner' } } }
            : { papel_ativo: { some: { tipo_papel: 'Owner' } } },
        ],
      }),
      ...(q.busca && {
        OR: [
          { nome: { contains: q.busca, mode: 'insensitive' } },
          { descricao: { contains: q.busca, mode: 'insensitive' } },
        ],
      }),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.ativo.findMany({
        where,
        include: INCLUDE_LISTA,
        orderBy: { updated_at: 'desc' },
        ...paginar(q),
      }),
      this.prisma.ativo.count({ where }),
    ]);
    return {
      dados: dados.map(comPendencias),
      total,
      pagina: q.pagina,
      limite: q.limite,
    };
  }

  async buscar(id: string) {
    const ativo = await this.prisma.ativo.findUniqueOrThrow({
      where: { id },
      include: INCLUDE_DETALHE,
    });
    return comPendencias(ativo);
  }

  /** O criador é registrado como Owner; o ativo nasce sempre como Rascunho. */
  criar(dto: CriarAtivoDto, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const novo = await tx.ativo.create({
        data: {
          ...dto,
          papel_ativo: {
            create: { pessoa_id: usuarioId, tipo_papel: 'Owner' },
          },
        },
      });
      await this.auditoria.registrar(tx, { usuarioId, tabela: TABELA, novo });
      return novo;
    });
  }

  /** Só Owner ou Responsável Técnico do ativo (ou Admin) editam. */
  atualizar(id: string, dto: AtualizarAtivoDto, usuario: UsuarioAutenticado) {
    const usuarioId = usuario.id;
    return this.prisma.$transaction(async (tx) => {
      await exigirPapelNoAtivo(tx, id, usuario, [
        'Owner',
        'Responsavel_Tecnico',
      ]);
      const antigo = await tx.ativo.findUniqueOrThrow({ where: { id } });
      const novo = await tx.ativo.update({ where: { id }, data: dto });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: TABELA,
        antigo,
        novo,
      });
      return novo;
    });
  }

  /**
   * Falha com 409 se o ativo já tiver decisões (histórico append-only).
   * Nesse caso, use situacao = 'Descontinuado'.
   */
  remover(id: string, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const antigo = await tx.ativo.delete({ where: { id } });
      await this.auditoria.registrar(tx, { usuarioId, tabela: TABELA, antigo });
    });
  }
}
