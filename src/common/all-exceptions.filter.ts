import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client.js';

interface ErrorMapping {
  status: HttpStatus;
  message: string;
}

const RETRY_AFTER_SECONDS = 5;

// Erros do Prisma/driver adapter traduzidos para HTTP.
// Mapeamento dos códigos: https://www.prisma.io/docs/orm/reference/error-reference
const PRISMA_CODE_MAP: Record<string, ErrorMapping> = {
  P2002: { status: HttpStatus.CONFLICT, message: 'Registro já existe' },
  P2003: { status: HttpStatus.CONFLICT, message: 'Violação de relacionamento' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Registro não encontrado' },
  P2034: {
    status: HttpStatus.CONFLICT,
    message: 'Conflito de escrita, tente novamente',
  },
  // Indisponibilidade (transitório)
  P1001: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Banco de dados indisponível',
  },
  P1011: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Banco de dados indisponível',
  },
  P1017: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Banco de dados indisponível',
  },
  P2024: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Banco de dados sobrecarregado',
  },
  P2037: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Banco de dados sobrecarregado',
  },
  // Timeout (transitório)
  P1008: {
    status: HttpStatus.GATEWAY_TIMEOUT,
    message: 'Tempo de consulta excedido',
  },
  P2028: {
    status: HttpStatus.GATEWAY_TIMEOUT,
    message: 'Tempo de transação excedido',
  },
};

// Erros do `pg` que nem sempre chegam com código Prisma (ex.: P2036 GenericJs).
const UNAVAILABLE_PATTERN =
  /timeout exceeded when trying to connect|Connection terminated|ECONNREFUSED|ECONNRESET|ENOTFOUND/i;
const TIMEOUT_PATTERN =
  /Query read timeout|canceling statement due to statement timeout/i;

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const corpo = exception.getResponse();
      // Exceções criadas com string (ex.: ThrottlerException) viram o formato padrão.
      response
        .status(status)
        .json(typeof corpo === 'string' ? { statusCode: status, message: corpo } : corpo);
      return;
    }

    const { status, message } = this.map(exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }
    if (status === HttpStatus.SERVICE_UNAVAILABLE) {
      response.setHeader('Retry-After', String(RETRY_AFTER_SECONDS));
    }

    response.status(status).json({ statusCode: status, message });
  }

  private map(exception: unknown): ErrorMapping {
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      PRISMA_CODE_MAP[exception.code]
    ) {
      return PRISMA_CODE_MAP[exception.code];
    }
    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return PRISMA_CODE_MAP.P1001;
    }

    const text =
      exception instanceof Error ? exception.message : String(exception);
    if (TIMEOUT_PATTERN.test(text)) return PRISMA_CODE_MAP.P1008;
    if (UNAVAILABLE_PATTERN.test(text)) return PRISMA_CODE_MAP.P1001;

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno',
    };
  }
}
