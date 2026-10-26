import { ForbiddenException } from '@nestjs/common';
import type { UsuarioAutenticado } from '../auth/decorators.js';
import type { TransactionClient } from '../prisma/prisma.service.js';

type TipoPapel = 'Owner' | 'Steward' | 'Responsavel_Tecnico' | 'Consumidor';

/**
 * Exige que o usuário exerça um dos papéis informados no ativo.
 * Admin do sistema passa sempre. Ativo inexistente vira 404 (P2025).
 */
export async function exigirPapelNoAtivo(
  tx: Pick<TransactionClient, 'ativo' | 'papel_ativo'>,
  ativoId: string,
  usuario: UsuarioAutenticado,
  permitidos: TipoPapel[],
) {
  await tx.ativo.findUniqueOrThrow({
    where: { id: ativoId },
    select: { id: true },
  });
  if (usuario.papel === 'Admin') return;

  const exerce = await tx.papel_ativo.count({
    where: {
      ativo_id: ativoId,
      pessoa_id: usuario.id,
      tipo_papel: { in: permitidos },
    },
  });
  if (!exerce) {
    throw new ForbiddenException(
      `Requer o papel ${permitidos.join(' ou ')} neste ativo`,
    );
  }
}
