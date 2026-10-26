import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { LIMITE_LOGIN, LIMITE_REFRESH } from '../common/rate-limit.js';
import { AlterarSenhaDto, LoginDto, RefreshDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { Public, UsuarioAtual, type UsuarioAutenticado } from './decorators.js';

const contexto = (req: Request) => ({
  userAgent: req.headers['user-agent'],
  ip: req.ip,
});

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: LIMITE_LOGIN })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.auth.login(dto.email, dto.senha, contexto(req));
  }

  @Public()
  @Throttle({ default: LIMITE_REFRESH })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() dto: RefreshDto, @Req() req: Request) {
    return this.auth.refresh(dto.refresh_token, contexto(req));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refresh_token);
  }

  @Get('me')
  me(@UsuarioAtual() usuario: UsuarioAutenticado) {
    return this.auth.me(usuario.id);
  }

  @Patch('senha')
  @HttpCode(204)
  async alterarSenha(
    @UsuarioAtual() usuario: UsuarioAutenticado,
    @Body() dto: AlterarSenhaDto,
  ) {
    await this.auth.alterarSenha(usuario.id, dto.senha_atual, dto.nova_senha);
  }
}
