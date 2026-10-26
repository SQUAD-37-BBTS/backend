import type { ThrottlerModuleOptions } from '@nestjs/throttler';

const MINUTO = 60_000;
const env = (nome: string, padrao: number) =>
  Number(process.env[nome] ?? padrao);

/** Limites de rotas sensíveis, aplicados com @Throttle({ default: ... }). */
export const LIMITE_LOGIN = {
  limit: env('RATE_LIMIT_LOGIN_MAX', 5),
  ttl: MINUTO,
  // Após estourar, bloqueia a origem por mais tempo que a janela (anti força bruta).
  blockDuration: env('RATE_LIMIT_LOGIN_BLOQUEIO_MIN', 5) * MINUTO,
};

export const LIMITE_REFRESH = {
  limit: env('RATE_LIMIT_REFRESH_MAX', 20),
  ttl: MINUTO,
};

export const opcoesRateLimit = (): ThrottlerModuleOptions => ({
  throttlers: [
    { name: 'default', ttl: MINUTO, limit: env('RATE_LIMIT_MAX', 120) },
  ],
  errorMessage: 'Muitas requisições, tente novamente mais tarde',
  // O guard roda depois do JwtAuthGuard: requisições autenticadas são contadas
  // por usuário (justo com vários usuários atrás do mesmo NAT); as demais, por IP.
  getTracker: (req) =>
    req.usuario?.id ? `u:${req.usuario.id}` : `ip:${req.ip}`,
});
