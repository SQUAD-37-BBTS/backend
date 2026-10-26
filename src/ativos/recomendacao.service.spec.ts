import { ConflictException, ForbiddenException } from '@nestjs/common';
import { vi } from 'vitest';
import {
  gerarRecomendacoes,
  RecomendacaoService,
} from './recomendacao.service.js';

const dono = { id: 'u-owner', email: 'o@x.com', papel: 'Usuario' as const };
const owner = [{ tipo_papel: 'Owner' }];

describe('gerarRecomendacoes', () => {
  it('ativo sem Owner gera recomendação', () => {
    const r = gerarRecomendacoes([], { usa_ia: false });
    expect(r.map((x) => x.codigo)).toEqual(['sem_owner']);
  });

  it('sem questionário recomenda preenchê-lo', () => {
    const r = gerarRecomendacoes(owner, null);
    expect(r.map((x) => x.codigo)).toEqual(['sem_questionario']);
  });

  it('IA sem supervisão humana recomenda monitoramento', () => {
    const r = gerarRecomendacoes(owner, {
      usa_ia: true,
      supervisao_humana: false,
    });
    expect(r.map((x) => x.codigo)).toEqual(['sem_supervisao']);
  });

  it('IA com dados pessoais recomenda revisão de proteção', () => {
    const r = gerarRecomendacoes(owner, {
      usa_ia: true,
      supervisao_humana: true,
      usa_dados_pessoais: true,
    });
    expect(r.map((x) => x.codigo)).toEqual(['ia_dados_pessoais']);
  });

  it('cadastro completo não gera recomendação', () => {
    expect(
      gerarRecomendacoes(owner, { usa_ia: false, supervisao_humana: true }),
    ).toEqual([]);
  });
});

function montar(opts: { papeis?: number; papel_ativo?: object[]; situacao?: string }) {
  const tx = {
    ativo: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        situacao: opts.situacao ?? 'Rascunho',
        papel_ativo: opts.papel_ativo ?? [],
        contextualizacao_avaliacao: null,
      }),
    },
    papel_ativo: { count: vi.fn().mockResolvedValue(opts.papeis ?? 1) },
    decisao: { create: vi.fn().mockResolvedValue({ id: 'd1' }) },
  };
  const prisma = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
  const auditoria = { registrar: vi.fn() };
  const service = new RecomendacaoService(prisma as never, auditoria as never);
  return { service, tx, auditoria };
}

describe('responder', () => {
  it('só o Owner responde (403) e nada é gravado', async () => {
    const { service, tx } = montar({ papeis: 0 });
    await expect(
      service.responder('a1', { acao: 'Aceitar', justificativa: 'ok' }, dono),
    ).rejects.toThrow(ForbiddenException);
    expect(tx.decisao.create).not.toHaveBeenCalled();
  });

  it('aceitar grava decisão append-only e audita, sem mudar a situação', async () => {
    const { service, tx, auditoria } = montar({});
    await service.responder(
      'a1',
      { acao: 'Aceitar', justificativa: 'vou definir' },
      dono,
    );
    const { data } = tx.decisao.create.mock.calls[0][0];
    expect(data).toMatchObject({
      tipo_decisao: 'Recomendacao_Aceita',
      resultado_decisao: 'Adequacao_Solicitada',
      responsavel_id: dono.id,
    });
    expect(data.justificativa).toContain('vou definir');
    expect(auditoria.registrar).toHaveBeenCalledTimes(1);
  });

  it('rejeitar também é registrado como decisão', async () => {
    const { service, tx } = montar({});
    await service.responder(
      'a1',
      { acao: 'Rejeitar', justificativa: 'risco assumido' },
      dono,
    );
    expect(tx.decisao.create.mock.calls[0][0].data).toMatchObject({
      tipo_decisao: 'Recomendacao_Rejeitada',
      resultado_decisao: 'Risco_Aceito',
    });
  });

  it('sem recomendação pendente dá 409', async () => {
    const { service, tx } = montar({ papel_ativo: owner });
    tx.ativo.findUniqueOrThrow.mockResolvedValue({
      situacao: 'Rascunho',
      papel_ativo: owner,
      contextualizacao_avaliacao: {
        respostas: { usa_ia: false, supervisao_humana: true },
      },
    });
    await expect(
      service.responder('a1', { acao: 'Aceitar', justificativa: 'ok' }, dono),
    ).rejects.toThrow(ConflictException);
    expect(tx.decisao.create).not.toHaveBeenCalled();
  });
});
