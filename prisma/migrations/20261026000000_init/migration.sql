-- Baseline do modelo Orion.
-- Idempotente: em um banco que já possui o modelo (ex.: o Supabase atual) não
-- altera nada; em um banco vazio cria tudo. Para marcar como aplicada num banco
-- existente sem executar: npx prisma migrate resolve --applied 20261026000000_init

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid() em PG < 13

-- ---------------------------------------------------------------- Funções

CREATE OR REPLACE FUNCTION public.fn_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_bloquear_alteracao_decisao() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'A tabela decisao é append-only: % não é permitido.', TG_OP;
END;
$$;

-- ---------------------------------------------------------------- Tabelas

CREATE TABLE IF NOT EXISTS public.pessoa (
  id            uuid         NOT NULL DEFAULT gen_random_uuid(),
  nome          varchar(150) NOT NULL,
  email         varchar(255) NOT NULL,
  area          varchar(150),
  senha_hash    text         NOT NULL,
  papel_sistema varchar(20)  NOT NULL DEFAULT 'Usuario',
  ativo         boolean      NOT NULL DEFAULT true,
  ultimo_login  timestamptz,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT pessoa_pkey PRIMARY KEY (id),
  CONSTRAINT uq_pessoa_email UNIQUE (email),
  CONSTRAINT ck_pessoa_papel_sistema CHECK (papel_sistema IN ('Admin', 'Usuario'))
);

CREATE TABLE IF NOT EXISTS public.dominio (
  id         uuid         NOT NULL DEFAULT gen_random_uuid(),
  nome       varchar(150) NOT NULL,
  owner_id   uuid         NOT NULL,
  created_at timestamptz  NOT NULL DEFAULT now(),
  updated_at timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT dominio_pkey PRIMARY KEY (id),
  CONSTRAINT uq_dominio_nome UNIQUE (nome),
  CONSTRAINT fk_dominio_owner FOREIGN KEY (owner_id) REFERENCES public.pessoa(id)
);

CREATE TABLE IF NOT EXISTS public.ativo (
  id              uuid         NOT NULL DEFAULT gen_random_uuid(),
  nome            varchar(200) NOT NULL,
  tipo_componente varchar(100) NOT NULL,
  descricao       text,
  objetivo        text,
  dominio_id      uuid         NOT NULL,
  situacao        varchar(30)  NOT NULL DEFAULT 'Rascunho',
  criticidade     varchar(30),
  usa_cloud       boolean      NOT NULL DEFAULT false,
  data_criacao    timestamptz  NOT NULL DEFAULT now(),
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT ativo_pkey PRIMARY KEY (id),
  CONSTRAINT fk_ativo_dominio FOREIGN KEY (dominio_id) REFERENCES public.dominio(id),
  CONSTRAINT ck_ativo_situacao CHECK (situacao IN ('Rascunho', 'Inventariado', 'Descontinuado')),
  CONSTRAINT ck_ativo_criticidade CHECK (criticidade IS NULL OR criticidade IN ('Baixa', 'Media', 'Alta', 'Critica'))
);

-- ON DELETE CASCADE: o criador vira Owner automaticamente, então sem cascade
-- nenhum ativo poderia ser removido (DELETE /ativos/:id).
CREATE TABLE IF NOT EXISTS public.papel_ativo (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  ativo_id   uuid        NOT NULL,
  pessoa_id  uuid        NOT NULL,
  tipo_papel varchar(30) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT papel_ativo_pkey PRIMARY KEY (id),
  CONSTRAINT uq_papel_ativo_pessoa_tipo UNIQUE (ativo_id, pessoa_id, tipo_papel),
  CONSTRAINT fk_papel_ativo_ativo FOREIGN KEY (ativo_id) REFERENCES public.ativo(id) ON DELETE CASCADE,
  CONSTRAINT fk_papel_ativo_pessoa FOREIGN KEY (pessoa_id) REFERENCES public.pessoa(id),
  CONSTRAINT ck_papel_ativo_tipo CHECK (tipo_papel IN ('Owner', 'Steward', 'Responsavel_Tecnico', 'Consumidor'))
);

CREATE TABLE IF NOT EXISTS public.contextualizacao_avaliacao (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  ativo_id   uuid        NOT NULL,
  respostas  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  data       timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contextualizacao_avaliacao_pkey PRIMARY KEY (id),
  CONSTRAINT uq_contextualizacao_ativo UNIQUE (ativo_id),
  CONSTRAINT fk_contextualizacao_ativo FOREIGN KEY (ativo_id) REFERENCES public.ativo(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.motor_enquadramento (
  id                       uuid         NOT NULL DEFAULT gen_random_uuid(),
  ativo_id                 uuid         NOT NULL,
  trilha_governanca        varchar(100) NOT NULL,
  explicacao_enquadramento text,
  data_calculo             timestamptz  NOT NULL DEFAULT now(),
  created_at               timestamptz  NOT NULL DEFAULT now(),
  updated_at               timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT motor_enquadramento_pkey PRIMARY KEY (id),
  CONSTRAINT uq_motor_enquadramento_ativo UNIQUE (ativo_id),
  CONSTRAINT fk_motor_enquadramento_ativo FOREIGN KEY (ativo_id) REFERENCES public.ativo(id) ON DELETE CASCADE
);

-- Append-only (triggers abaixo). Sem cascade: ativo com decisões não é removível.
CREATE TABLE IF NOT EXISTS public.decisao (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  ativo_id          uuid        NOT NULL,
  tipo_decisao      varchar(50) NOT NULL,
  responsavel_id    uuid        NOT NULL,
  justificativa     text        NOT NULL,
  resultado_decisao varchar(30) NOT NULL,
  data              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT decisao_pkey PRIMARY KEY (id),
  CONSTRAINT fk_decisao_ativo FOREIGN KEY (ativo_id) REFERENCES public.ativo(id),
  CONSTRAINT fk_decisao_responsavel FOREIGN KEY (responsavel_id) REFERENCES public.pessoa(id),
  CONSTRAINT ck_decisao_resultado CHECK (resultado_decisao IN ('Aprovado', 'Rejeitado', 'Risco_Aceito', 'Adequacao_Solicitada'))
);

CREATE TABLE IF NOT EXISTS public.catalogo_modelo_fundacional (
  id              uuid         NOT NULL DEFAULT gen_random_uuid(),
  fornecedor      varchar(100) NOT NULL,
  modelo          varchar(150) NOT NULL,
  versao_variante varchar(100),
  situacao        varchar(30)  NOT NULL DEFAULT 'Em_Avaliacao',
  restricoes_uso  text,
  responsavel_id  uuid         NOT NULL,
  inicio_vigencia date,
  proxima_revisao date,
  created_at      timestamptz  NOT NULL DEFAULT now(),
  updated_at      timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT catalogo_modelo_fundacional_pkey PRIMARY KEY (id),
  CONSTRAINT uq_catalogo_modelo UNIQUE (fornecedor, modelo, versao_variante),
  CONSTRAINT fk_catalogo_modelo_responsavel FOREIGN KEY (responsavel_id) REFERENCES public.pessoa(id),
  CONSTRAINT ck_catalogo_modelo_situacao CHECK (situacao IN ('Homologado', 'Em_Avaliacao', 'Restrito', 'Descontinuado'))
);

CREATE TABLE IF NOT EXISTS public.catalogo_tecnologia (
  id         uuid         NOT NULL DEFAULT gen_random_uuid(),
  nome_tec   varchar(150) NOT NULL,
  fornecedor varchar(150),
  created_at timestamptz  NOT NULL DEFAULT now(),
  updated_at timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT catalogo_tecnologia_pkey PRIMARY KEY (id),
  CONSTRAINT uq_catalogo_tecnologia UNIQUE (nome_tec, fornecedor)
);

CREATE TABLE IF NOT EXISTS public.log_auditoria (
  id             uuid         NOT NULL DEFAULT gen_random_uuid(),
  usuario_id     uuid         NOT NULL,
  tabela_afetada varchar(100) NOT NULL,
  valor_antigo   jsonb,
  valor_novo     jsonb,
  data_alteracao timestamptz  NOT NULL DEFAULT now(),
  motivo         text,
  CONSTRAINT log_auditoria_pkey PRIMARY KEY (id),
  CONSTRAINT fk_log_auditoria_usuario FOREIGN KEY (usuario_id) REFERENCES public.pessoa(id)
);

CREATE TABLE IF NOT EXISTS public.refresh_token (
  id          uuid         NOT NULL DEFAULT gen_random_uuid(),
  pessoa_id   uuid         NOT NULL,
  token_hash  text         NOT NULL,
  criado_em   timestamptz  NOT NULL DEFAULT now(),
  expira_em   timestamptz  NOT NULL,
  revogado_em timestamptz,
  user_agent  varchar(255),
  ip_origem   inet,
  CONSTRAINT refresh_token_pkey PRIMARY KEY (id),
  CONSTRAINT uq_refresh_token_hash UNIQUE (token_hash),
  CONSTRAINT fk_refresh_token_pessoa FOREIGN KEY (pessoa_id) REFERENCES public.pessoa(id) ON DELETE CASCADE
);

-- ---------------------------------------------------------------- Índices

CREATE INDEX IF NOT EXISTS ix_pessoa_email                   ON public.pessoa (email);
CREATE INDEX IF NOT EXISTS ix_ativo_dominio_id               ON public.ativo (dominio_id);
CREATE INDEX IF NOT EXISTS ix_ativo_situacao                 ON public.ativo (situacao);
CREATE INDEX IF NOT EXISTS ix_papel_ativo_ativo_id           ON public.papel_ativo (ativo_id);
CREATE INDEX IF NOT EXISTS ix_papel_ativo_pessoa_id          ON public.papel_ativo (pessoa_id);
CREATE INDEX IF NOT EXISTS ix_contextualizacao_respostas_gin ON public.contextualizacao_avaliacao USING gin (respostas);
CREATE INDEX IF NOT EXISTS ix_decisao_ativo_id               ON public.decisao (ativo_id);
CREATE INDEX IF NOT EXISTS ix_decisao_responsavel_id         ON public.decisao (responsavel_id);
CREATE INDEX IF NOT EXISTS ix_log_auditoria_data             ON public.log_auditoria (data_alteracao);
CREATE INDEX IF NOT EXISTS ix_log_auditoria_tabela_afetada   ON public.log_auditoria (tabela_afetada);
CREATE INDEX IF NOT EXISTS ix_log_auditoria_usuario_id       ON public.log_auditoria (usuario_id);
CREATE INDEX IF NOT EXISTS ix_refresh_token_expira_em        ON public.refresh_token (expira_em);
CREATE INDEX IF NOT EXISTS ix_refresh_token_pessoa_id        ON public.refresh_token (pessoa_id);

-- ---------------------------------------------------------------- Triggers
-- A API não preenche updated_at (o Prisma só usa DEFAULT now()); o banco mantém.

DROP TRIGGER IF EXISTS trg_pessoa_updated_at ON public.pessoa;
CREATE TRIGGER trg_pessoa_updated_at BEFORE UPDATE ON public.pessoa
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_dominio_updated_at ON public.dominio;
CREATE TRIGGER trg_dominio_updated_at BEFORE UPDATE ON public.dominio
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_ativo_updated_at ON public.ativo;
CREATE TRIGGER trg_ativo_updated_at BEFORE UPDATE ON public.ativo
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_papel_ativo_updated_at ON public.papel_ativo;
CREATE TRIGGER trg_papel_ativo_updated_at BEFORE UPDATE ON public.papel_ativo
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_contextualizacao_updated_at ON public.contextualizacao_avaliacao;
CREATE TRIGGER trg_contextualizacao_updated_at BEFORE UPDATE ON public.contextualizacao_avaliacao
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_motor_enquadramento_updated_at ON public.motor_enquadramento;
CREATE TRIGGER trg_motor_enquadramento_updated_at BEFORE UPDATE ON public.motor_enquadramento
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_catalogo_modelo_updated_at ON public.catalogo_modelo_fundacional;
CREATE TRIGGER trg_catalogo_modelo_updated_at BEFORE UPDATE ON public.catalogo_modelo_fundacional
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_catalogo_tecnologia_updated_at ON public.catalogo_tecnologia;
CREATE TRIGGER trg_catalogo_tecnologia_updated_at BEFORE UPDATE ON public.catalogo_tecnologia
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_decisao_bloquear_update ON public.decisao;
CREATE TRIGGER trg_decisao_bloquear_update BEFORE UPDATE ON public.decisao
  FOR EACH ROW EXECUTE FUNCTION public.fn_bloquear_alteracao_decisao();

DROP TRIGGER IF EXISTS trg_decisao_bloquear_delete ON public.decisao;
CREATE TRIGGER trg_decisao_bloquear_delete BEFORE DELETE ON public.decisao
  FOR EACH ROW EXECUTE FUNCTION public.fn_bloquear_alteracao_decisao();
