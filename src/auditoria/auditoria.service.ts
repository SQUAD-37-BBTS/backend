import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { paginar, type PaginacaoQueryDto } from '../common/paginacao.dto.js';
import {
  PrismaService,
  type TransactionClient,
} from '../prisma/prisma.service.js';

interface Registro {
  usuarioId: string;
  tabela: string;
  antigo?: unknown;
  novo?: unknown;
  motivo?: string;
}

// Serializa para JSON removendo campos sensíveis.
const paraJson = (valor: unknown) =>
  valor === undefined
    ? undefined
    : (JSON.parse(
        JSON.stringify(valor, (chave, v) =>
          chave === 'senha_hash' ? undefined : v,
        ),
      ) as Prisma.InputJsonValue);

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  /** Deve ser chamado dentro da mesma transação da alteração auditada. */
  registrar(tx: TransactionClient, r: Registro) {
    return tx.log_auditoria.create({
      data: {
        usuario_id: r.usuarioId,
        tabela_afetada: r.tabela,
        valor_antigo: paraJson(r.antigo),
        valor_novo: paraJson(r.novo),
        motivo: r.motivo,
      },
    });
  }

  async listar(
    filtros: PaginacaoQueryDto & { tabela?: string; usuario_id?: string },
  ) {
    const where: Prisma.log_auditoriaWhereInput = {
      tabela_afetada: filtros.tabela,
      usuario_id: filtros.usuario_id,
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.log_auditoria.findMany({
        where,
        orderBy: { data_alteracao: 'desc' },
        include: { pessoa: { select: { id: true, nome: true, email: true } } },
        ...paginar(filtros),
      }),
      this.prisma.log_auditoria.count({ where }),
    ]);
    return { dados, total, pagina: filtros.pagina, limite: filtros.limite };
  }
}
