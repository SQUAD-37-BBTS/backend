import { ConflictException, ForbiddenException } from '@nestjs/common';
import { vi } from 'vitest';
import { AtivoDetalhesService } from './ativo-detalhes.service.js';

const dono = { id: 'u-owner', email: 'o@x.com', papel: 'Usuario' as const };
const admin = { id: 'u-admin', email: 'a@x.com', papel: 'Admin' as const };
const dto = {
  tipo_decisao: 'Uso',
  justificativa: 'ok',
  resultado_decisao: 'Aprovado',
};

function montar(opts: {
  situacao?: string;
  papeis?: number;
  contextualizacao?: number;
}) {
  const tx = {
    ativo: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: 'a1',
        situacao: opts.situacao ?? 'Rascunho',
      }),
      update: vi.fn().mockResolvedValue({ id: 'a1', situacao: 'Inventariado' }),
    },
    papel_ativo: { count: vi.fn().mockResolvedValue(opts.papeis ?? 1) },
    contextualizacao_avaliacao: {
      count: vi.fn().mockResolvedValue(opts.contextualizacao ?? 1),
    },
    decisao: { create: vi.fn().mockResolvedValue({ id: 'd1' }) },
  };
  const prisma = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
  const auditoria = { registrar: vi.fn() };
  const service = new AtivoDetalhesService(prisma as never, auditoria as never);
  return { service, tx, auditoria };
}

describe('registrarDecisao', () => {
  it('nega quem não é Owner do ativo (403) e não grava', async () => {
    const { service, tx } = montar({ papeis: 0 });
    await expect(service.registrarDecisao('a1', dto, dono)).rejects.toThrow(
      ForbiddenException,
    );
    expect(tx.decisao.create).not.toHaveBeenCalled();
  });

  it('Admin decide sem ser Owner', async () => {
    const { service, tx } = montar({ papeis: 0 });
    await service.registrarDecisao('a1', dto, admin);
    expect(tx.decisao.create).toHaveBeenCalled();
  });

  it('aprovação inventaria o ativo e audita decisão e ativo', async () => {
    const { service, tx, auditoria } = montar({});
    await service.registrarDecisao('a1', dto, dono);
    expect(tx.ativo.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { situacao: 'Inventariado' },
    });
    expect(auditoria.registrar).toHaveBeenCalledTimes(2);
  });

  it('rejeição não muda a situação', async () => {
    const { service, tx } = montar({});
    await service.registrarDecisao(
      'a1',
      { ...dto, resultado_decisao: 'Rejeitado' },
      dono,
    );
    expect(tx.ativo.update).not.toHaveBeenCalled();
  });

  it('aprovar sem questionário preenchido dá 409', async () => {
    const { service, tx } = montar({ contextualizacao: 0 });
    await expect(service.registrarDecisao('a1', dto, dono)).rejects.toThrow(
      ConflictException,
    );
    expect(tx.decisao.create).not.toHaveBeenCalled();
  });

  it('ativo descontinuado não recebe decisão (409)', async () => {
    const { service } = montar({ situacao: 'Descontinuado' });
    await expect(service.registrarDecisao('a1', dto, dono)).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('papéis', () => {
  it('só Owner adiciona papel', async () => {
    const { service } = montar({ papeis: 0 });
    await expect(
      service.adicionarPapel(
        'a1',
        { pessoa_id: 'p', tipo_papel: 'Steward' },
        dono,
      ),
    ).rejects.toThrow(ForbiddenException);
  });
});
