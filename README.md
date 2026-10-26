# Orion — Backend

API REST em [NestJS](https://nestjs.com) + Prisma (PostgreSQL/Supabase) para inventário e governança de ativos de IA: domínios, pessoas, ativos (papéis, contextualização, enquadramento e decisões), catálogo de modelos/tecnologias e trilha de auditoria.

## Como rodar

```bash
npm install
cp .env.example .env     # preencha DATABASE_URL, DIRECT_URL e JWT_SECRET

npm run start:dev        # desenvolvimento (watch)
npm run build && npm run start:prod
```

Criar o primeiro Admin:

```bash
npm run build
ADMIN_NOME="..." ADMIN_EMAIL="..." ADMIN_SENHA="..." npm run admin:criar
```

### Banco de dados (migration e seed)

```bash
npx prisma migrate deploy   # aplica as migrations pendentes (usa DIRECT_URL)

npm run build
SEED_SENHA="..." npm run db:seed   # dados de exemplo (senha mín. 8; sem ela, é gerada e exibida uma vez)
```

- A migration `prisma/migrations/20261026000000_init` é um baseline **idempotente**: num banco vazio cria tudo (tabelas, checks, índices e triggers); num banco que já tem o modelo não altera nada. Em um banco existente sem `_prisma_migrations`, marque-a como aplicada uma vez: `npx prisma migrate resolve --applied 20261026000000_init`.
- Os triggers mantêm `updated_at` (a API não o preenche) e tornam `decisao` append-only.
- O seed é **apenas aditivo e idempotente**: não altera nem remove registros existentes e pode ser reexecutado. Cria pessoas (`*@orion.local`, uma Admin), domínios, catálogo, ativos com papéis, contextualização, enquadramento, decisões e auditoria.
- O seed se recusa a rodar com `NODE_ENV=production` (cria um Admin com senha conhecida); para forçar, defina `SEED_PERMITIR_PRODUCAO=true`.
- `src/generated/` (client do Prisma) é gerado por `npx prisma generate`.

Testes e lint: `npm run test`, `npm run test:e2e`, `npm run lint`.

### Variáveis de ambiente

| Variável | Descrição | Padrão |
| --- | --- | --- |
| `DATABASE_URL` | Conexão (pooler, porta 6543) usada em runtime | — |
| `DIRECT_URL` | Conexão direta (porta 5432) usada pelo Prisma CLI | — |
| `JWT_SECRET` | Segredo de assinatura do access token | — |
| `JWT_ACCESS_TTL_SEGUNDOS` | Validade do access token | `900` |
| `JWT_REFRESH_TTL_DIAS` | Validade do refresh token | `7` |
| `PORT` | Porta HTTP | `3000` |
| `TRUST_PROXY` | Nº de proxies confiáveis (para `req.ip` correto) | — |
| `HTTP_TIMEOUT_MS` | Timeout por requisição | `10000` |
| `DB_POOL_MAX`, `DB_CONNECTION_TIMEOUT_MS`, `DB_QUERY_TIMEOUT_MS` | Pool e timeouts do banco | `10`, `5000`, `8000` |
| `RATE_LIMIT_MAX` | Requisições/min por usuário (ou IP) | `120` |
| `RATE_LIMIT_LOGIN_MAX`, `RATE_LIMIT_LOGIN_BLOQUEIO_MIN` | Tentativas de login/min e minutos de bloqueio ao estourar | `5`, `5` |
| `RATE_LIMIT_REFRESH_MAX` | Refresh/min | `20` |

## Convenções da API

- **Autenticação:** todas as rotas exigem `Authorization: Bearer <access_token>`, exceto as marcadas como **Pública**.
- **Autorização:** rotas marcadas **Admin** exigem `papel_sistema = Admin`; as demais aceitam qualquer usuário autenticado.
- **Validação:** o corpo é validado com whitelist — campos desconhecidos retornam `400`. IDs em rotas (`:id`) devem ser UUID.
- **Paginação** (`GET` de listas): query `pagina` (≥ 1, padrão 1) e `limite` (1–100, padrão 20). Resposta: `{ dados, total, pagina, limite }`.
- **Rate limit:** padrão por usuário autenticado (ou por IP); `429` ao estourar.
- **Erros:** `{ statusCode, message }`. Erros do banco são traduzidos: `404` (não encontrado), `409` (já existe / violação de relacionamento), `503` (banco indisponível, com `Retry-After`), `504` (timeout).
- **Auditoria:** criações, alterações e remoções registram o usuário responsável (consulte em `GET /auditoria`).

---

## Roteiro dos endpoints

Legenda de acesso: 🌐 Pública · 🔒 Autenticado · 👑 Admin

### Saúde

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/` | 🌐 | Resposta simples (`Hello World!`). |
| GET | `/health/live` | 🌐 | Liveness: processo está de pé (`{ status: "ok" }`). Não consulta o banco. |
| GET | `/health/ready` | 🌐 | Readiness: testa o banco (timeout 2 s). `200 { status, database: "up" }` ou `503 { database: "down" }`. Fora do rate limit. |

### Autenticação — `/auth`

| Método | Rota | Acesso | Corpo | Resposta |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | 🌐 | `{ email, senha }` | `200 { access_token, refresh_token, token_type: "Bearer" }` |
| POST | `/auth/refresh` | 🌐 | `{ refresh_token }` | `200` novo par de tokens (rotação) |
| POST | `/auth/logout` | 🌐 | `{ refresh_token }` | `204` revoga o refresh token |
| GET | `/auth/me` | 🔒 | — | Dados da pessoa autenticada |
| PATCH | `/auth/senha` | 🔒 | `{ senha_atual, nova_senha }` (mín. 8) | `204`; revoga todas as sessões |

Fluxo recomendado:

1. `POST /auth/login` → guarde `access_token` e `refresh_token`.
2. Envie `Authorization: Bearer <access_token>` nas demais chamadas.
3. Ao receber `401`, chame `POST /auth/refresh` com o `refresh_token` e **substitua ambos os tokens** (cada refresh é de uso único).
4. Reusar um refresh token já usado/revogado derruba todas as sessões da pessoa.
5. `POST /auth/logout` ao sair.

Observações: login limitado a `RATE_LIMIT_LOGIN_MAX` tentativas/min, com bloqueio temporário ao estourar; credenciais inválidas e usuário inativo retornam `401 Credenciais inválidas`.

### Pessoas — `/pessoas`

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/pessoas` | 🔒 | Lista paginada. Filtros: `busca`, `ativo` (`true`/`false`). |
| GET | `/pessoas/:id` | 🔒 | Busca por ID. |
| POST | `/pessoas` | 👑 | Cria. Corpo: `nome`, `email`, `senha` (mín. 8), `area?`, `papel_sistema?` (`Admin` \| `Usuario`). |
| PATCH | `/pessoas/:id` | 👑 | Atualiza `nome`, `email`, `area`, `papel_sistema`, `ativo` (senha não é alterada aqui). |
| DELETE | `/pessoas/:id` | 👑 | Desativa a pessoa (`204`). |

### Domínios — `/dominios`

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/dominios` | 🔒 | Lista paginada. Filtro: `busca`. |
| GET | `/dominios/:id` | 🔒 | Busca por ID. |
| POST | `/dominios` | 👑 | Cria. Corpo: `nome`, `owner_id` (UUID de pessoa). |
| PATCH | `/dominios/:id` | 👑 | Atualiza `nome` e/ou `owner_id`. |
| DELETE | `/dominios/:id` | 👑 | Remove (`204`). `409` se houver ativos vinculados. |

### Ativos — `/ativos`

**Ativo**

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/ativos` | 🔒 | Lista paginada. Filtros: `busca`, `dominio_id`, `situacao`, `criticidade`, `usa_cloud`, `pessoa_id` (ativos em que a pessoa tem algum papel). |
| GET | `/ativos/:id` | 🔒 | Busca por ID. |
| POST | `/ativos` | 🔒 | Cria. Corpo: `nome`, `tipo_componente`, `dominio_id`, `descricao?`, `objetivo?`, `situacao?`, `criticidade?`, `usa_cloud?`. |
| PATCH | `/ativos/:id` | 🔒 | Atualiza qualquer campo da criação. |
| DELETE | `/ativos/:id` | 👑 | Remove (`204`). |

**Papéis** (quem faz o quê no ativo)

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/ativos/:id/papeis` | 🔒 | Lista papéis (com dados resumidos da pessoa). |
| POST | `/ativos/:id/papeis` | 🔒 | Adiciona. Corpo: `pessoa_id`, `tipo_papel`. |
| DELETE | `/ativos/:id/papeis/:papelId` | 🔒 | Remove (`204`). |

**Contextualização** (questionário de avaliação)

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/ativos/:id/contextualizacao` | 🔒 | Busca as respostas (`404` se ainda não preenchida). |
| PUT | `/ativos/:id/contextualizacao` | 🔒 | Cria/substitui. Corpo: `{ respostas: { ... } }`. |

**Enquadramento** (trilha de governança)

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/ativos/:id/enquadramento` | 🔒 | Busca o enquadramento (`404` se inexistente). |
| PUT | `/ativos/:id/enquadramento` | 👑 | Cria/substitui manualmente. Corpo: `trilha_governanca`, `explicacao_enquadramento?`. |

**Decisões** (histórico imutável — só inclusão)

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/ativos/:id/decisoes` | 🔒 | Lista, da mais recente para a mais antiga. |
| POST | `/ativos/:id/decisoes` | 🔒 | Registra. Corpo: `tipo_decisao`, `justificativa`, `resultado_decisao`. O responsável é o usuário autenticado. |

Valores aceitos:

| Campo | Valores |
| --- | --- |
| `situacao` (ativo) | `Rascunho`, `Inventariado`, `Descontinuado` |
| `criticidade` | `Baixa`, `Media`, `Alta`, `Critica` |
| `tipo_papel` | `Owner`, `Steward`, `Responsavel_Tecnico`, `Consumidor` |
| `resultado_decisao` | `Aprovado`, `Rejeitado`, `Risco_Aceito`, `Adequacao_Solicitada` |

### Catálogo — `/catalogo`

Leitura para qualquer usuário autenticado; escrita somente Admin.

**Modelos**

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/catalogo/modelos` | 🔒 | Lista paginada. Filtros: `busca`, `situacao`. |
| GET | `/catalogo/modelos/:id` | 🔒 | Busca por ID. |
| POST | `/catalogo/modelos` | 👑 | Cria. Corpo: `fornecedor`, `modelo`, `responsavel_id`, `versao_variante?`, `situacao?`, `restricoes_uso?`, `inicio_vigencia?`, `proxima_revisao?` (datas ISO `YYYY-MM-DD`). |
| PATCH | `/catalogo/modelos/:id` | 👑 | Atualiza qualquer campo da criação. |
| DELETE | `/catalogo/modelos/:id` | 👑 | Remove (`204`). |

`situacao` (modelo): `Homologado`, `Em_Avaliacao`, `Restrito`, `Descontinuado`.

**Tecnologias**

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/catalogo/tecnologias` | 🔒 | Lista paginada. Filtro: `busca`. |
| GET | `/catalogo/tecnologias/:id` | 🔒 | Busca por ID. |
| POST | `/catalogo/tecnologias` | 👑 | Cria. Corpo: `nome_tec`, `fornecedor?`. |
| PATCH | `/catalogo/tecnologias/:id` | 👑 | Atualiza `nome_tec` e/ou `fornecedor`. |
| DELETE | `/catalogo/tecnologias/:id` | 👑 | Remove (`204`). |

### Auditoria — `/auditoria`

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/auditoria` | 👑 | Lista paginada de registros de auditoria. Filtros: `tabela`, `usuario_id`. |

---

## Roteiro de uso (primeiros passos)

1. **Admin inicial:** `npm run admin:criar` (ver acima).
2. **Login** em `POST /auth/login`.
3. **Pessoas:** `POST /pessoas` para cadastrar quem será owner/responsável.
4. **Domínio:** `POST /dominios` com `owner_id`.
5. **Catálogo (opcional):** `POST /catalogo/modelos` e `/catalogo/tecnologias`.
6. **Ativo:** `POST /ativos` com `dominio_id`.
7. **Detalhar o ativo:** `POST /ativos/:id/papeis` → `PUT /ativos/:id/contextualizacao` → `PUT /ativos/:id/enquadramento` (Admin) → `POST /ativos/:id/decisoes`.
8. **Acompanhar:** `GET /ativos` com filtros e `GET /auditoria` (Admin).
