import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AtivosModule } from './ativos/ativos.module.js';
import { AuditoriaModule } from './auditoria/auditoria.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/jwt-auth.guard.js';
import { RolesGuard } from './auth/roles.guard.js';
import { CatalogoModule } from './catalogo/catalogo.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { opcoesRateLimit } from './common/rate-limit.js';
import { TimeoutInterceptor } from './common/timeout.interceptor.js';
import { DominiosModule } from './dominios/dominios.module.js';
import { HealthModule } from './health/health.module.js';
import { PessoasModule } from './pessoas/pessoas.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({ useFactory: opcoesRateLimit }),
    PrismaModule,
    AuditoriaModule,
    AuthModule,
    HealthModule,
    PessoasModule,
    DominiosModule,
    AtivosModule,
    CatalogoModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guards globais, nesta ordem: autentica → checa papel → rate limit
    // (por usuário quando autenticado, por IP caso contrário).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
