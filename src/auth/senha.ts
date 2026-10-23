import { hash, verify } from '@node-rs/argon2';

export const hashSenha = (senha: string) => hash(senha);

export const verificarSenha = (senhaHash: string, senha: string) =>
  verify(senhaHash, senha).catch(() => false);
