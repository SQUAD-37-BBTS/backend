import { Controller, Get, Query } from '@nestjs/common';
import { IsOptional, IsString, IsUUID } from 'class-validator';
import { Roles } from '../auth/decorators.js';
import { PaginacaoQueryDto } from '../common/paginacao.dto.js';
import { AuditoriaService } from './auditoria.service.js';

class AuditoriaQueryDto extends PaginacaoQueryDto {
  @IsOptional()
  @IsString()
  tabela?: string;

  @IsOptional()
  @IsUUID()
  usuario_id?: string;
}

@Controller('auditoria')
@Roles('Admin')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  listar(@Query() query: AuditoriaQueryDto) {
    return this.auditoria.listar(query);
  }
}
