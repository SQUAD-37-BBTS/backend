// Popula o banco com dados de exemplo. Idempotente e apenas aditivo: nunca
// altera nem remove registros existentes (reexecutar não duplica nada).
// Uso:
//   npm run build && SEED_SENHA="..." npm run db:seed
// Sem SEED_SENHA, uma senha aleatória é gerada e exibida uma única vez.
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { hashSenha } from '../auth/senha.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

const prisma = new PrismaService();

const senhaInformada = process.env.SEED_SENHA;
if (senhaInformada !== undefined && senhaInformada.length < 8) {
  console.error('SEED_SENHA deve ter no mínimo 8 caracteres.');
  process.exit(1);
}
const senha = senhaInformada ?? randomBytes(12).toString('base64url');
const senha_hash = await hashSenha(senha);

const MOTIVO = 'seed';

// ---------- Pessoas

const PESSOAS = [
  { nome: 'Ana Souza', email: 'ana.souza@orion.local', area: 'Governança de IA', papel_sistema: 'Admin' },
  { nome: 'Bruno Lima', email: 'bruno.lima@orion.local', area: 'Atendimento', papel_sistema: 'Usuario' },
  { nome: 'Carla Mendes', email: 'carla.mendes@orion.local', area: 'Risco e Crédito', papel_sistema: 'Usuario' },
  { nome: 'Diego Rocha', email: 'diego.rocha@orion.local', area: 'Engenharia de Dados', papel_sistema: 'Usuario' },
] as const;

const pessoa: Record<string, string> = {};
for (const p of PESSOAS) {
  const { id } = await prisma.pessoa.upsert({
    where: { email: p.email },
    create: { ...p, senha_hash },
    update: {}, // não sobrescreve senha nem dados de quem já existe
    select: { id: true },
  });
  pessoa[p.email.split('.')[0]] = id; // ana | bruno | carla | diego
}

// ---------- Domínios

const DOMINIOS = [
  { nome: 'Atendimento ao Cliente', owner: 'bruno' },
  { nome: 'Crédito e Risco', owner: 'carla' },
  { nome: 'Dados e Analytics', owner: 'diego' },
] as const;

const dominio: Record<string, string> = {};
for (const d of DOMINIOS) {
  const { id } = await prisma.dominio.upsert({
    where: { nome: d.nome },
    create: { nome: d.nome, owner_id: pessoa[d.owner] },
    update: {},
    select: { id: true },
  });
  dominio[d.nome] = id;
}

// ---------- Catálogo
// Chaves únicas com coluna nullable não funcionam em upsert: findFirst + create.

interface ModeloSeed {
  fornecedor: string;
  modelo: string;
  versao_variante: string | null;
  situacao: string;
  restricoes_uso?: string;
  inicio_vigencia?: string;
  proxima_revisao?: string;
}

const MODELOS: ModeloSeed[] = [
  { fornecedor: 'Anthropic', modelo: 'Claude', versao_variante: 'Sonnet', situacao: 'Homologado', inicio_vigencia: '2026-01-15', proxima_revisao: '2026-07-15' },
  { fornecedor: 'OpenAI', modelo: 'GPT-4o', versao_variante: null, situacao: 'Restrito', restricoes_uso: 'Proibido para dados pessoais sensíveis e dados de clientes.', inicio_vigencia: '2025-09-01', proxima_revisao: '2026-03-01' },
  { fornecedor: 'Google', modelo: 'Gemini', versao_variante: 'Pro', situacao: 'Em_Avaliacao', proxima_revisao: '2026-12-01' },
  { fornecedor: 'Meta', modelo: 'Llama 2', versao_variante: '70B', situacao: 'Descontinuado', restricoes_uso: 'Substituído por versões mais recentes.', inicio_vigencia: '2024-06-01' },
];

for (const { inicio_vigencia, proxima_revisao, ...m } of MODELOS) {
  const existe = await prisma.catalogo_modelo_fundacional.findFirst({
    where: { fornecedor: m.fornecedor, modelo: m.modelo, versao_variante: m.versao_variante },
    select: { id: true },
  });
  if (existe) continue;
  await prisma.catalogo_modelo_fundacional.create({
    data: {
      ...m,
      responsavel_id: pessoa.ana,
      inicio_vigencia: inicio_vigencia ? new Date(inicio_vigencia) : undefined,
      proxima_revisao: proxima_revisao ? new Date(proxima_revisao) : undefined,
    },
  });
}

const TECNOLOGIAS = [
  { nome_tec: 'PostgreSQL', fornecedor: 'PostgreSQL Global Development Group' },
  { nome_tec: 'pgvector', fornecedor: null },
  { nome_tec: 'LangChain', fornecedor: 'LangChain Inc.' },
  { nome_tec: 'Databricks', fornecedor: 'Databricks' },
  { nome_tec: 'Azure AI Search', fornecedor: 'Microsoft' },
] as const;

for (const t of TECNOLOGIAS) {
  const existe = await prisma.catalogo_tecnologia.findFirst({
    where: t,
    select: { id: true },
  });
  if (!existe) await prisma.catalogo_tecnologia.create({ data: t });
}

// ---------- Ativos (com papéis, contextualização, enquadramento e decisões)

interface AtivoSeed {
  nome: string;
  tipo_componente: string;
  descricao: string;
  objetivo: string;
  dominio: string;
  situacao: 'Rascunho' | 'Inventariado' | 'Descontinuado';
  criticidade?: 'Baixa' | 'Media' | 'Alta' | 'Critica';
  usa_cloud: boolean;
  papeis: [pessoa: string, tipo: string][];
  respostas?: Prisma.InputJsonObject;
  enquadramento?: { trilha_governanca: string; explicacao_enquadramento: string };
  decisoes?: { tipo_decisao: string; responsavel: string; justificativa: string; resultado_decisao: string }[];
}

const ATIVOS: AtivoSeed[] = [
  {
    nome: 'Assistente Virtual de Atendimento',
    tipo_componente: 'Chatbot',
    descricao: 'Chatbot generativo que responde dúvidas de clientes no app e no site.',
    objetivo: 'Reduzir o tempo médio de atendimento e o volume de chamados no primeiro nível.',
    dominio: 'Atendimento ao Cliente',
    situacao: 'Inventariado',
    criticidade: 'Alta',
    usa_cloud: true,
    papeis: [['bruno', 'Owner'], ['ana', 'Steward'], ['diego', 'Responsavel_Tecnico']],
    respostas: {
      usa_dados_pessoais: true,
      interage_com_cliente_final: true,
      decisao_automatizada: false,
      modelo_fundacional: 'Anthropic Claude Sonnet',
      supervisao_humana: true,
    },
    enquadramento: {
      trilha_governanca: 'Reforcada',
      explicacao_enquadramento: 'Interage diretamente com clientes e trata dados pessoais.',
    },
    decisoes: [
      { tipo_decisao: 'Aprovacao_Inicial', responsavel: 'ana', justificativa: 'Controles de privacidade e supervisão humana validados.', resultado_decisao: 'Aprovado' },
    ],
  },
  {
    nome: 'Motor de Score de Crédito',
    tipo_componente: 'Modelo Preditivo',
    descricao: 'Modelo de machine learning que estima a probabilidade de inadimplência.',
    objetivo: 'Apoiar a concessão de crédito com decisões consistentes e rastreáveis.',
    dominio: 'Crédito e Risco',
    situacao: 'Inventariado',
    criticidade: 'Critica',
    usa_cloud: false,
    papeis: [['carla', 'Owner'], ['ana', 'Steward'], ['diego', 'Responsavel_Tecnico'], ['bruno', 'Consumidor']],
    respostas: {
      usa_dados_pessoais: true,
      interage_com_cliente_final: false,
      decisao_automatizada: true,
      explicabilidade: 'SHAP',
      supervisao_humana: true,
    },
    enquadramento: {
      trilha_governanca: 'Reforcada',
      explicacao_enquadramento: 'Decisão automatizada com impacto financeiro direto sobre o cliente.',
    },
    decisoes: [
      { tipo_decisao: 'Aprovacao_Inicial', responsavel: 'ana', justificativa: 'Documentação de viés e explicabilidade completa.', resultado_decisao: 'Adequacao_Solicitada' },
      { tipo_decisao: 'Reavaliacao', responsavel: 'ana', justificativa: 'Ajustes de monitoramento de drift implementados.', resultado_decisao: 'Aprovado' },
    ],
  },
  {
    nome: 'Busca Semântica de Documentos Internos',
    tipo_componente: 'RAG',
    descricao: 'Busca com embeddings sobre políticas e manuais internos.',
    objetivo: 'Facilitar o acesso a normativos pelos colaboradores.',
    dominio: 'Dados e Analytics',
    situacao: 'Inventariado',
    criticidade: 'Media',
    usa_cloud: true,
    papeis: [['diego', 'Owner'], ['ana', 'Steward'], ['bruno', 'Consumidor'], ['carla', 'Consumidor']],
    respostas: {
      usa_dados_pessoais: false,
      interage_com_cliente_final: false,
      decisao_automatizada: false,
      modelo_fundacional: 'Google Gemini Pro',
    },
    enquadramento: {
      trilha_governanca: 'Padrao',
      explicacao_enquadramento: 'Uso interno, sem dados pessoais e sem decisão automatizada.',
    },
    decisoes: [
      { tipo_decisao: 'Aprovacao_Inicial', responsavel: 'ana', justificativa: 'Risco aceito enquanto o modelo está em avaliação, com revisão em 90 dias.', resultado_decisao: 'Risco_Aceito' },
    ],
  },
  {
    nome: 'Classificador de Reclamações',
    tipo_componente: 'Modelo de Classificação',
    descricao: 'Classifica reclamações por tema e urgência.',
    objetivo: 'Priorizar o tratamento de reclamações críticas.',
    dominio: 'Atendimento ao Cliente',
    situacao: 'Rascunho',
    usa_cloud: true,
    papeis: [['bruno', 'Owner']],
  },
  {
    nome: 'Previsão de Demanda (legado)',
    tipo_componente: 'Modelo Preditivo',
    descricao: 'Modelo de séries temporais substituído pela plataforma atual de analytics.',
    objetivo: 'Prever volume de operações para dimensionamento de equipe.',
    dominio: 'Dados e Analytics',
    situacao: 'Descontinuado',
    criticidade: 'Baixa',
    usa_cloud: false,
    papeis: [['diego', 'Owner']],
  },
];

let criados = 0;
for (const a of ATIVOS) {
  const dominio_id = dominio[a.dominio];
  const existente = await prisma.ativo.findFirst({
    where: { nome: a.nome, dominio_id },
    select: { id: true },
  });
  if (existente) continue; // ativo já semeado (ou criado à mão): não toca em nada
  criados++;

  const ativo = await prisma.ativo.create({
    data: {
      nome: a.nome,
      tipo_componente: a.tipo_componente,
      descricao: a.descricao,
      objetivo: a.objetivo,
      dominio_id,
      situacao: a.situacao,
      criticidade: a.criticidade,
      usa_cloud: a.usa_cloud,
      papel_ativo: {
        create: a.papeis.map(([p, tipo_papel]) => ({
          pessoa_id: pessoa[p],
          tipo_papel,
        })),
      },
      ...(a.respostas && {
        contextualizacao_avaliacao: { create: { respostas: a.respostas } },
      }),
      ...(a.enquadramento && {
        motor_enquadramento: { create: a.enquadramento },
      }),
    },
  });

  // Decisões são append-only (o banco bloqueia UPDATE/DELETE).
  if (a.decisoes?.length) {
    await prisma.decisao.createMany({
      data: a.decisoes.map(({ responsavel, ...d }) => ({
        ...d,
        ativo_id: ativo.id,
        responsavel_id: pessoa[responsavel],
      })),
    });
  }

  await prisma.log_auditoria.create({
    data: {
      usuario_id: pessoa.ana,
      tabela_afetada: 'ativo',
      valor_novo: JSON.parse(JSON.stringify(ativo)) as Prisma.InputJsonObject,
      motivo: MOTIVO,
    },
  });
}

console.log(
  `Seed concluído: ${PESSOAS.length} pessoas, ${DOMINIOS.length} domínios, ` +
    `${MODELOS.length} modelos, ${TECNOLOGIAS.length} tecnologias; ` +
    `${criados} de ${ATIVOS.length} ativos criados.`,
);
if (senhaInformada === undefined) {
  console.log(`Senha gerada para as pessoas do seed (não será exibida de novo): ${senha}`);
}
await prisma.$disconnect();
