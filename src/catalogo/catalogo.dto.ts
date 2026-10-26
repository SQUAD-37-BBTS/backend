import { PartialType } from '@nestjs/mapped-types';
import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { SITUACAO_MODELO } from '../common/enums.js';
import { PaginacaoQueryDto } from '../common/paginacao.dto.js';

export class CriarModeloDto {
  @IsString()
  @MaxLength(100)
  fornecedor: string;

  @IsString()
  @MaxLength(150)
  modelo: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  versao_variante?: string;

  @IsOptional()
  @IsIn(SITUACAO_MODELO)
  situacao?: string;

  @IsOptional()
  @IsString()
  restricoes_uso?: string;

  @IsUUID()
  responsavel_id: string;

  @IsOptional()
  @IsDateString({ strict: true })
  inicio_vigencia?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  proxima_revisao?: string;
}

export class AtualizarModeloDto extends PartialType(CriarModeloDto) {}

export class ModelosQueryDto extends PaginacaoQueryDto {
  @IsOptional()
  @IsString()
  busca?: string;

  @IsOptional()
  @IsIn(SITUACAO_MODELO)
  situacao?: string;
}

export class CriarTecnologiaDto {
  @IsString()
  @MaxLength(150)
  nome_tec: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  fornecedor?: string;
}

export class AtualizarTecnologiaDto extends PartialType(CriarTecnologiaDto) {}

export class TecnologiasQueryDto extends PaginacaoQueryDto {
  @IsOptional()
  @IsString()
  busca?: string;
}
