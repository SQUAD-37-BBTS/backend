import {
  BadGatewayException,
  GatewayTimeoutException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { afterEach, beforeEach, vi } from 'vitest';
import { SugestaoIaService } from './sugestao-ia.service.js';

const dono = { id: 'u-owner', email: 'o@x.com', papel: 'Usuario' as const };
const DESCRICAO = 'Agente de atendimento que usa IA generativa com dados de clientes';

function montar(descricao: string | null = DESCRICAO) {
  const tx = {
    ativo: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        nome: 'Agente VIC',
        tipo_componente: 'Agente',
        descricao,
        objetivo: null,
      }),
    },
    papel_ativo: { count: vi.fn().mockResolvedValue(1) },
  };
  const prisma = { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) };
  return new SugestaoIaService(prisma as never);
}

const respostaIa = (conteudo: unknown) =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(conteudo) }] } }],
    }),
  );

describe('SugestaoIaService', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'chave-de-teste';
  });
  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
    vi.unstubAllGlobals();
  });

  it('descrição vazia ou curta dá 422 e não chama a IA', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(montar('curta').sugerir('a1', dono)).rejects.toThrow(
      UnprocessableEntityException,
    );
    await expect(montar(null).sugerir('a1', dono)).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retorna só sugestões válidas, marcadas como origem ia', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respostaIa({
          usa_ia: { valor: true, justificativa: 'IA generativa' },
          usa_dados_pessoais: { valor: 'sim' },
          campo_inventado: { valor: true },
        }),
      ),
    );
    const r = await montar().sugerir('a1', dono);
    expect(r.origem).toBe('ia');
    expect(r.sugestoes).toEqual({
      usa_ia: { valor: true, justificativa: 'IA generativa' },
    });
  });

  it('resposta inconsistente dá 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaIa({ nada: 1 })));
    await expect(montar().sugerir('a1', dono)).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('serviço fora do ar dá 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })));
    await expect(montar().sugerir('a1', dono)).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('timeout dá 504', async () => {
    const erro = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(erro));
    await expect(montar().sugerir('a1', dono)).rejects.toThrow(
      GatewayTimeoutException,
    );
  });

  it('sem chave configurada dá 502 e o questionário segue manual', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(montar().sugerir('a1', dono)).rejects.toThrow(
      BadGatewayException,
    );
  });

  it('abre o circuito após falhas seguidas, sem novas chamadas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = montar();
    for (let i = 0; i < 3; i++) {
      await expect(service.sugerir('a1', dono)).rejects.toThrow();
    }
    await expect(service.sugerir('a1', dono)).rejects.toThrow(
      BadGatewayException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
