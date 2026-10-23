import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // CLI (migrate, db push, studio) usa a conexão direta do Supabase (porta 5432)
    url: env('DIRECT_URL'),
  },
});
