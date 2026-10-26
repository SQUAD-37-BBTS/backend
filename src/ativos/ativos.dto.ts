import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  CRITICIDADE,
  RESULTADO_DECISAO,
  SITUACAO_ATIVO,
  TIPO_PAPEL,
} from '../common/enums.js';
import { PaginacaoQueryDto } from '../common/paginacao.dto.js';

export class CriarAtivoDto {
  @IsString()
  @MaxLength(200)
  nome: string;

  @IsString()
  @MaxLength(100)
  tipo_componente: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  objetivo?: string;

  @IsUUID()
  dominio_id: string;

  @IsOptional()
  @IsIn(CRITICIDADE)
  criticidade?: string;

  @IsOptional()
  @IsBoolean()
  usa_cloud?: boolean;
}

// A situação nunca é informada no cadastro (nasce "Rascunho"). "Inventariado"
// só vem do registro de decisão; na edição só é permitido descontinuar.
export class AtualizarAtivoDto extends PartialType(CriarAtivoDto) {
  @IsOptional()
  @IsIn(['Descontinuado'])
  situacao?: string;
}

export class AtivosQueryDto extends PaginacaoQueryDto {
  @IsOptional()
  @IsString()
  busca?: string;

  @IsOptional()
  @IsUUID()
  dominio_id?: string;

  @IsOptional()
  @IsIn(SITUACAO_ATIVO)
  situacao?: string;

  @IsOptional()
  @IsIn(CRITICIDADE)
  criticidade?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  usa_cloud?: boolean;

  /** Filtra ativos em que a pessoa exerce algum papel. */
  @IsOptional()
  @IsUUID()
  pessoa_id?: string;

  /** Com pessoa_id, restringe ao papel exercido ("meus ativos como Steward"). */
  @IsOptional()
  @IsIn(TIPO_PAPEL)
  tipo_papel?: string;

  /** true lista só ativos sem Owner (pendência); false, só os com Owner. */
  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  sem_owner?: boolean;
}

export class CriarPapelDto {
  @IsUUID()
  pessoa_id: string;

  @IsIn(TIPO_PAPEL)
  tipo_papel: string;
}

export class SalvarContextualizacaoDto {
  @IsObject()
  respostas: Record<string, unknown>;
}

export class SalvarEnquadramentoDto {
  @IsString()
  @MaxLength(100)
  trilha_governanca: string;

  @IsOptional()
  @IsString()
  explicacao_enquadramento?: string;
}

export class CriarDecisaoDto {
  @IsString()
  @MaxLength(50)
  tipo_decisao: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  justificativa: string;

  @IsIn(RESULTADO_DECISAO)
  resultado_decisao: string;
}
