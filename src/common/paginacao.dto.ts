import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginacaoQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 20;
}

export interface Pagina<T> {
  dados: T[];
  total: number;
  pagina: number;
  limite: number;
}

export function paginar({ pagina, limite }: PaginacaoQueryDto) {
  return { skip: (pagina - 1) * limite, take: limite };
}
