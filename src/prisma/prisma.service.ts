import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '../generated/prisma/client.js';

// Campos nunca retornados por padrão (inclusive em includes aninhados).
// Para ler explicitamente: `omit: { senha_hash: false }`.
const OMIT_PADRAO = { pessoa: { senha_hash: true } } as const;

type Opcoes = Prisma.PrismaClientOptions & { omit: typeof OMIT_PADRAO };

@Injectable()
export class PrismaService
  extends PrismaClient<Opcoes>
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const adapter = new PrismaPg(
      {
        connectionString: process.env.DATABASE_URL,
        // Limita conexões simultâneas (bulkhead) — respeite o limite do pooler do Supabase.
        max: Number(process.env.DB_POOL_MAX ?? 10),
        // Falha rápido se o banco/pooler estiver fora do ar ou o pool esgotado.
        connectionTimeoutMillis: Number(
          process.env.DB_CONNECTION_TIMEOUT_MS ?? 5_000,
        ),
        idleTimeoutMillis: 30_000,
        // Timeout do lado do cliente por query; deve ser menor que HTTP_TIMEOUT_MS.
        query_timeout: Number(process.env.DB_QUERY_TIMEOUT_MS ?? 8_000),
      },
      { schema: process.env.DB_SCHEMA },
    );
    super({
      adapter,
      omit: OMIT_PADRAO,
      transactionOptions: { maxWait: 2_000, timeout: 5_000 },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export type TransactionClient = Parameters<
  Parameters<PrismaService['$transaction']>[0]
>[0];
