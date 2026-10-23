import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Server } from 'node:http';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Atrás de proxy/load balancer, req.ip precisa vir do X-Forwarded-For —
  // senão o rate limit trata todos os clientes como um só IP.
  // Use o nº de proxies confiáveis (ex.: 1), nunca `true` em produção.
  if (process.env.TRUST_PROXY) {
    const valor = process.env.TRUST_PROXY;
    app.set('trust proxy', /^\d+$/.test(valor) ? Number(valor) : valor);
  }

  // Origens do front liberadas (separadas por vírgula). Padrão: Vite local.
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((o) => o.trim()),
  });

  // Fecha o pool do banco e conexões abertas ao receber SIGTERM/SIGINT.
  app.enableShutdownHooks();

  // Limites no nível do servidor HTTP (acima do TimeoutInterceptor).
  const server = app.getHttpServer() as Server;
  server.requestTimeout = 15_000;
  server.headersTimeout = 16_000;
  server.keepAliveTimeout = 5_000;

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
