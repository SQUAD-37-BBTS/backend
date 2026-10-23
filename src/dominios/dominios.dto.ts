import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginacaoQueryDto } from '../common/paginacao.dto.js';

export class CriarDominioDto {
  @IsString()
  @MaxLength(150)
  nome: string;

  @IsUUID()
  owner_id: string;
}

export class AtualizarDominioDto extends PartialType(CriarDominioDto) {}

export class DominiosQueryDto extends PaginacaoQueryDto {
  @IsOptional()
  @IsString()
  busca?: string;
}
