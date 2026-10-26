import { vi } from 'vitest';
import { DashboardService } from './dashboard.service.js';

describe('DashboardService.resumo', () => {
  it('agrega contagens e aplica o filtro de domínio em todas as consultas', async () => {
    const count = vi.fn().mockResolvedValue(3);
    const g = (rows: unknown[]) => vi.fn().mockResolvedValue(rows);
    const prisma = {
      $transaction: (qs: Promise<unknown>[]) => Promise.all(qs),
      ativo: {
        count,
        groupBy: vi
          .fn()
          .mockResolvedValueOnce([{ situacao: 'Rascunho', _count: { _all: 2 } }])
          .mockResolvedValueOnce([
            { criticidade: 'Alta', _count: { _all: 1 } },
            { criticidade: null, _count: { _all: 2 } },
          ])
          .mockResolvedValueOnce([{ dominio_id: 'd1', _count: { _all: 3 } }]),
      },
      motor_enquadramento: {
        groupBy: g([{ trilha_governanca: 'T1', _count: { _all: 1 } }]),
      },
      dominio: {
        findMany: vi.fn().mockResolvedValue([{ id: 'd1', nome: 'Financeiro' }]),
      },
    };
    const r = await new DashboardService(prisma as never).resumo({
      dominio_id: 'd1',
    });

    expect(r.total).toBe(3);
    expect(r.por_situacao).toEqual({ Rascunho: 2 });
    expect(r.por_criticidade).toEqual({ Alta: 1, Nao_Classificada: 2 });
    expect(r.por_trilha).toEqual({ T1: 1 });
    expect(r.por_dominio).toEqual([
      { dominio_id: 'd1', nome: 'Financeiro', total: 3 },
    ]);
    expect(r.pendencias.sem_owner).toBe(3);
    expect(count.mock.calls[0][0]).toEqual({ where: { dominio_id: 'd1' } });
  });
});
