import { PartialType, OmitType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PAPEL_SISTEMA } from '../common/enums.js';
import { PaginacaoQueryDto } from '../common/paginacao.dto.js';

export class CriarPessoaDto {
  @IsString()
  @MaxLength(150)
  nome: string;

  @IsEmail()
  @MaxLength(255)
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  area?: string;

  @IsString()
  @MinLength(8)
  senha: string;

  @IsOptional()
  @IsIn(PAPEL_SISTEMA)
  papel_sistema?: string;
}

export class AtualizarPessoaDto extends PartialType(
  OmitType(CriarPessoaDto, ['senha']),
) {
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class PessoasQueryDto extends PaginacaoQueryDto {
  @IsOptional()
  @IsString()
  busca?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  ativo?: boolean;
}
