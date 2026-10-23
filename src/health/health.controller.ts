import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators.js';
import { PrismaService } from '../prisma/prisma.service.js';

const READINESS_TIMEOUT_MS = 2_000;

// Sondas do orquestrador/load balancer não entram no rate limit.
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Liveness: o processo está de pé. Não depende do banco, para o
  // orquestrador não reiniciar a instância quando o problema é externo.
  @Get('live')
  live() {
    return { status: 'ok' };
  }

  // Readiness: a instância consegue atender tráfego (banco acessível).
  @Get('ready')
  async ready() {
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('readiness timeout')),
            READINESS_TIMEOUT_MS,
          ),
        ),
      ]);
      return { status: 'ok', database: 'up' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }
  }
}
