// Espelham as check constraints do banco (ck_*). Manter sincronizado.

export const PAPEL_SISTEMA = ['Admin', 'Usuario'] as const;
export type PapelSistema = (typeof PAPEL_SISTEMA)[number];

export const SITUACAO_ATIVO = [
  'Rascunho',
  'Inventariado',
  'Descontinuado',
] as const;

export const CRITICIDADE = ['Baixa', 'Media', 'Alta', 'Critica'] as const;

export const TIPO_PAPEL = [
  'Owner',
  'Steward',
  'Responsavel_Tecnico',
  'Consumidor',
] as const;

export const RESULTADO_DECISAO = [
  'Aprovado',
  'Rejeitado',
  'Risco_Aceito',
  'Adequacao_Solicitada',
] as const;

export const SITUACAO_MODELO = [
  'Homologado',
  'Em_Avaliacao',
  'Restrito',
  'Descontinuado',
] as const;
