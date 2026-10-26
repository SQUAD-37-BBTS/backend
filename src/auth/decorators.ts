import {
  ExecutionContext,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import type { PapelSistema } from '../common/enums.js';

export interface UsuarioAutenticado {
  id: string;
  email: string;
  papel: PapelSistema;
}

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';

/** Rota acessível sem access token. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Restringe a rota aos papéis de sistema informados. */
export const Roles = (...papeis: PapelSistema[]) => SetMetadata(ROLES, papeis);

export const UsuarioAtual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado =>
    ctx.switchToHttp().getRequest().usuario,
);
