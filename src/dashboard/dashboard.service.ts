import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DashboardQueryDto } from './dashboard.dto.js';

const SEM_VALOR = 'Nao_Classificada';

const contagem = <K extends string>(
  linhas: ({ _count: { _all: number } } & { [P in K]: string | null })[],
  chave: K,
) =>
  Object.fromEntries(
    linhas.map((l) => [l[chave] ?? SEM_VALOR, l._count._all]),
  );

/** Indicadores agregados do catálogo. Os filtros espelham os de GET /ativos. */
@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async resumo(q: DashboardQueryDto) {
    const base: Prisma.ativoWhereInput = { dominio_id: q.dominio_id };

    const [
      total,
      porSituacao,
      porCriticidade,
      porDominio,
      porTrilha,
      semOwner,
      aguardandoDecisao,
      semQuestionario,
    ] = await this.prisma.$transaction([
      this.prisma.ativo.count({ where: base }),
      this.prisma.ativo.groupBy({
        by: ['situacao'],
        where: base,
        orderBy: { situacao: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.ativo.groupBy({
        by: ['criticidade'],
        where: base,
        orderBy: { criticidade: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.ativo.groupBy({
        by: ['dominio_id'],
        where: base,
        orderBy: { dominio_id: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.motor_enquadramento.groupBy({
        by: ['trilha_governanca'],
        where: { ativo: base },
        orderBy: { trilha_governanca: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.ativo.count({
        where: { ...base, papel_ativo: { none: { tipo_papel: 'Owner' } } },
      }),
      // Rascunho = ainda não recebeu decisão de aprovação/risco aceito.
      this.prisma.ativo.count({ where: { ...base, situacao: 'Rascunho' } }),
      this.prisma.ativo.count({
        where: { ...base, contextualizacao_avaliacao: { is: null } },
      }),
    ]);

    const dominios = await this.prisma.dominio.findMany({
      where: { id: { in: porDominio.map((d) => d.dominio_id) } },
      select: { id: true, nome: true },
    });
    const nomeDe = new Map(dominios.map((d) => [d.id, d.nome]));

    return {
      total,
      por_situacao: contagem(porSituacao, 'situacao'),
      por_criticidade: contagem(porCriticidade, 'criticidade'),
      por_trilha: contagem(porTrilha, 'trilha_governanca'),
      por_dominio: porDominio.map((d) => ({
        dominio_id: d.dominio_id,
        nome: nomeDe.get(d.dominio_id) ?? null,
        total: d._count._all,
      })),
      pendencias: {
        sem_owner: semOwner,
        aguardando_decisao: aguardandoDecisao,
        sem_questionario: semQuestionario,
      },
    };
  }
}
