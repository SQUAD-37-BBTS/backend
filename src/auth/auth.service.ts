import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';
import type { PapelSistema } from '../common/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AccessTokenPayload } from './jwt-auth.guard.js';
import { hashSenha, verificarSenha } from './senha.js';

const REFRESH_TTL_MS =
  Number(process.env.JWT_REFRESH_TTL_DIAS ?? 7) * 24 * 60 * 60 * 1000;

// Usado quando o e-mail não existe, para o tempo de resposta não revelar
// quais e-mails estão cadastrados.
const HASH_FICTICIO = hashSenha('senha-ficticia-para-timing');

interface Contexto {
  userAgent?: string;
  ip?: string;
}

// Refresh token é aleatório de alta entropia: SHA-256 basta (não precisa de argon2).
const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(email: string, senha: string, ctx: Contexto) {
    const pessoa = await this.prisma.pessoa.findUnique({
      where: { email: email.toLowerCase() },
      omit: { senha_hash: false },
    });
    const senhaOk = await verificarSenha(
      pessoa?.senha_hash ?? (await HASH_FICTICIO),
      senha,
    );
    if (!pessoa || !senhaOk || !pessoa.ativo) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    await this.prisma.pessoa.update({
      where: { id: pessoa.id },
      data: { ultimo_login: new Date() },
    });
    return this.emitirTokens(pessoa, ctx);
  }

  async refresh(refreshToken: string, ctx: Contexto) {
    const registro = await this.prisma.refresh_token.findUnique({
      where: { token_hash: hashToken(refreshToken) },
      include: { pessoa: true },
    });
    if (!registro) throw new UnauthorizedException();

    // Reuso de um token já rotacionado/revogado indica vazamento:
    // derruba todas as sessões da pessoa.
    if (registro.revogado_em) {
      await this.revogarTodas(registro.pessoa_id);
      throw new UnauthorizedException();
    }
    if (registro.expira_em < new Date() || !registro.pessoa.ativo) {
      throw new UnauthorizedException();
    }

    // Rotação: o token usado é revogado e um novo par é emitido.
    // updateMany com revogado_em: null evita corrida entre dois refresh simultâneos.
    const { count } = await this.prisma.refresh_token.updateMany({
      where: { id: registro.id, revogado_em: null },
      data: { revogado_em: new Date() },
    });
    if (count === 0) throw new UnauthorizedException();

    return this.emitirTokens(registro.pessoa, ctx);
  }

  async logout(refreshToken: string) {
    await this.prisma.refresh_token.updateMany({
      where: { token_hash: hashToken(refreshToken), revogado_em: null },
      data: { revogado_em: new Date() },
    });
  }

  async alterarSenha(pessoaId: string, senhaAtual: string, novaSenha: string) {
    const pessoa = await this.prisma.pessoa.findUniqueOrThrow({
      where: { id: pessoaId },
      omit: { senha_hash: false },
    });
    if (!(await verificarSenha(pessoa.senha_hash, senhaAtual))) {
      throw new UnauthorizedException('Senha atual incorreta');
    }
    await this.prisma.pessoa.update({
      where: { id: pessoaId },
      data: { senha_hash: await hashSenha(novaSenha) },
    });
    await this.revogarTodas(pessoaId);
  }

  me(pessoaId: string) {
    return this.prisma.pessoa.findUniqueOrThrow({ where: { id: pessoaId } });
  }

  private revogarTodas(pessoaId: string) {
    return this.prisma.refresh_token.updateMany({
      where: { pessoa_id: pessoaId, revogado_em: null },
      data: { revogado_em: new Date() },
    });
  }

  private async emitirTokens(
    pessoa: { id: string; email: string; papel_sistema: string },
    ctx: Contexto,
  ) {
    const payload: AccessTokenPayload = {
      sub: pessoa.id,
      email: pessoa.email,
      papel: pessoa.papel_sistema as PapelSistema,
    };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refresh_token.create({
      data: {
        pessoa_id: pessoa.id,
        token_hash: hashToken(refreshToken),
        expira_em: new Date(Date.now() + REFRESH_TTL_MS),
        user_agent: ctx.userAgent?.slice(0, 255),
        ip_origem: ctx.ip,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
    };
  }
}
