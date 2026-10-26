import { Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { paginar } from '../common/paginacao.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AtualizarDominioDto,
  CriarDominioDto,
  DominiosQueryDto,
} from './dominios.dto.js';

const TABELA = 'dominio';
const INCLUDE = {
  pessoa: { select: { id: true, nome: true, email: true } },
  _count: { select: { ativo: true } },
} satisfies Prisma.dominioInclude;

@Injectable()
export class DominiosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(q: DominiosQueryDto) {
    const where: Prisma.dominioWhereInput = q.busca
      ? { nome: { contains: q.busca, mode: 'insensitive' } }
      : {};
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.dominio.findMany({
        where,
        include: INCLUDE,
        orderBy: { nome: 'asc' },
        ...paginar(q),
      }),
      this.prisma.dominio.count({ where }),
    ]);
    return { dados, total, pagina: q.pagina, limite: q.limite };
  }

  buscar(id: string) {
    return this.prisma.dominio.findUniqueOrThrow({
      where: { id },
      include: INCLUDE,
    });
  }

  criar(dto: CriarDominioDto, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const novo = await tx.dominio.create({ data: dto });
      await this.auditoria.registrar(tx, { usuarioId, tabela: TABELA, novo });
      return novo;
    });
  }

  atualizar(id: string, dto: AtualizarDominioDto, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const antigo = await tx.dominio.findUniqueOrThrow({ where: { id } });
      const novo = await tx.dominio.update({ where: { id }, data: dto });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: TABELA,
        antigo,
        novo,
      });
      return novo;
    });
  }

  /** Falha com 409 se houver ativos vinculados (FK sem cascade). */
  remover(id: string, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const antigo = await tx.dominio.delete({ where: { id } });
      await this.auditoria.registrar(tx, { usuarioId, tabela: TABELA, antigo });
    });
  }
}
