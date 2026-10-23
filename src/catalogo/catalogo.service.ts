import { Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { paginar } from '../common/paginacao.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AtualizarModeloDto,
  AtualizarTecnologiaDto,
  CriarModeloDto,
  CriarTecnologiaDto,
  ModelosQueryDto,
  TecnologiasQueryDto,
} from './catalogo.dto.js';

const INCLUDE_MODELO = {
  pessoa: { select: { id: true, nome: true, email: true } },
} satisfies Prisma.catalogo_modelo_fundacionalInclude;

// Colunas @db.Date: converte 'YYYY-MM-DD' em Date.
const datas = (dto: AtualizarModeloDto) => ({
  ...dto,
  inicio_vigencia: dto.inicio_vigencia
    ? new Date(dto.inicio_vigencia)
    : undefined,
  proxima_revisao: dto.proxima_revisao
    ? new Date(dto.proxima_revisao)
    : undefined,
});

@Injectable()
export class CatalogoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // ---------- Modelos fundacionais

  async listarModelos(q: ModelosQueryDto) {
    const where: Prisma.catalogo_modelo_fundacionalWhereInput = {
      situacao: q.situacao,
      ...(q.busca && {
        OR: [
          { fornecedor: { contains: q.busca, mode: 'insensitive' } },
          { modelo: { contains: q.busca, mode: 'insensitive' } },
        ],
      }),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.catalogo_modelo_fundacional.findMany({
        where,
        include: INCLUDE_MODELO,
        orderBy: [{ fornecedor: 'asc' }, { modelo: 'asc' }],
        ...paginar(q),
      }),
      this.prisma.catalogo_modelo_fundacional.count({ where }),
    ]);
    return { dados, total, pagina: q.pagina, limite: q.limite };
  }

  buscarModelo(id: string) {
    return this.prisma.catalogo_modelo_fundacional.findUniqueOrThrow({
      where: { id },
      include: INCLUDE_MODELO,
    });
  }

  criarModelo(dto: CriarModeloDto, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const novo = await tx.catalogo_modelo_fundacional.create({
        data: datas(dto) as CriarModeloDto,
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: 'catalogo_modelo_fundacional',
        novo,
      });
      return novo;
    });
  }

  atualizarModelo(id: string, dto: AtualizarModeloDto, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const antigo = await tx.catalogo_modelo_fundacional.findUniqueOrThrow({
        where: { id },
      });
      const novo = await tx.catalogo_modelo_fundacional.update({
        where: { id },
        data: datas(dto),
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: 'catalogo_modelo_fundacional',
        antigo,
        novo,
      });
      return novo;
    });
  }

  removerModelo(id: string, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const antigo = await tx.catalogo_modelo_fundacional.delete({
        where: { id },
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: 'catalogo_modelo_fundacional',
        antigo,
      });
    });
  }

  // ---------- Tecnologias

  async listarTecnologias(q: TecnologiasQueryDto) {
    const where: Prisma.catalogo_tecnologiaWhereInput = q.busca
      ? {
          OR: [
            { nome_tec: { contains: q.busca, mode: 'insensitive' } },
            { fornecedor: { contains: q.busca, mode: 'insensitive' } },
          ],
        }
      : {};
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.catalogo_tecnologia.findMany({
        where,
        orderBy: { nome_tec: 'asc' },
        ...paginar(q),
      }),
      this.prisma.catalogo_tecnologia.count({ where }),
    ]);
    return { dados, total, pagina: q.pagina, limite: q.limite };
  }

  buscarTecnologia(id: string) {
    return this.prisma.catalogo_tecnologia.findUniqueOrThrow({ where: { id } });
  }

  criarTecnologia(dto: CriarTecnologiaDto, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const novo = await tx.catalogo_tecnologia.create({ data: dto });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: 'catalogo_tecnologia',
        novo,
      });
      return novo;
    });
  }

  atualizarTecnologia(
    id: string,
    dto: AtualizarTecnologiaDto,
    usuarioId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const antigo = await tx.catalogo_tecnologia.findUniqueOrThrow({
        where: { id },
      });
      const novo = await tx.catalogo_tecnologia.update({
        where: { id },
        data: dto,
      });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: 'catalogo_tecnologia',
        antigo,
        novo,
      });
      return novo;
    });
  }

  removerTecnologia(id: string, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const antigo = await tx.catalogo_tecnologia.delete({ where: { id } });
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: 'catalogo_tecnologia',
        antigo,
      });
    });
  }
}
