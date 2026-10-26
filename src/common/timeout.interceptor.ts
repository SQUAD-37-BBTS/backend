import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import {
  Observable,
  TimeoutError,
  catchError,
  throwError,
  timeout,
} from 'rxjs';

// Tempo máximo de processamento de uma requisição. Deve ser maior que o
// timeout de query do banco, para que o erro do banco apareça primeiro.
const HTTP_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS ?? 10_000);

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      timeout(HTTP_TIMEOUT_MS),
      catchError((err: unknown) =>
        throwError(() =>
          err instanceof TimeoutError ? new RequestTimeoutException() : err,
        ),
      ),
    );
  }
}
