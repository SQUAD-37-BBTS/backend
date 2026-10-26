// Cria (ou promove) o primeiro Admin. Uso:
//   npm run build && ADMIN_NOME="..." ADMIN_EMAIL="..." ADMIN_SENHA="..." npm run admin:criar
import 'dotenv/config';
import { hashSenha } from '../auth/senha.js';
import { PrismaService } from '../prisma/prisma.service.js';

const { ADMIN_NOME = 'Administrador', ADMIN_EMAIL, ADMIN_SENHA } = process.env;
if (!ADMIN_EMAIL || !ADMIN_SENHA || ADMIN_SENHA.length < 8) {
  console.error('Defina ADMIN_EMAIL e ADMIN_SENHA (mínimo 8 caracteres).');
  process.exit(1);
}

const prisma = new PrismaService();
const email = ADMIN_EMAIL.toLowerCase();
const senha_hash = await hashSenha(ADMIN_SENHA);

const pessoa = await prisma.pessoa.upsert({
  where: { email },
  create: { nome: ADMIN_NOME, email, senha_hash, papel_sistema: 'Admin' },
  update: { senha_hash, papel_sistema: 'Admin', ativo: true },
});
console.log(`Admin pronto: ${pessoa.email} (${pessoa.id})`);
await prisma.$disconnect();
