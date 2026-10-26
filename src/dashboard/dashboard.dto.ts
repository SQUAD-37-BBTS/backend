import { IsOptional, IsUUID } from 'class-validator';

export class DashboardQueryDto {
  /** Restringe os indicadores a um domínio/área. */
  @IsOptional()
  @IsUUID()
  dominio_id?: string;
}
