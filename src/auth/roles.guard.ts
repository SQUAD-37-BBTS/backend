import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PapelSistema } from '../common/enums.js';
import { ROLES, UsuarioAutenticado } from './decorators.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const papeis = this.reflector.getAllAndOverride<PapelSistema[] | undefined>(
      ROLES,
      [context.getHandler(), context.getClass()],
    );
    if (!papeis?.length) return true;

    const usuario: UsuarioAutenticado | undefined = context
      .switchToHttp()
      .getRequest().usuario;
    return !!usuario && papeis.includes(usuario.papel);
  }
}
