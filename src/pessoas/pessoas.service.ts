import { Injectable } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service.js';
import { hashSenha } from '../auth/senha.js';
import { paginar } from '../common/paginacao.dto.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AtualizarPessoaDto,
  CriarPessoaDto,
  PessoasQueryDto,
} from './pessoas.dto.js';

const TABELA = 'pessoa';

@Injectable()
export class PessoasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async listar(q: PessoasQueryDto) {
    const where: Prisma.pessoaWhereInput = {
      ativo: q.ativo,
      ...(q.busca && {
        OR: [
          { nome: { contains: q.busca, mode: 'insensitive' } },
          { email: { contains: q.busca, mode: 'insensitive' } },
        ],
      }),
    };
    const [dados, total] = await this.prisma.$transaction([
      this.prisma.pessoa.findMany({
        where,
        orderBy: { nome: 'asc' },
        ...paginar(q),
      }),
      this.prisma.pessoa.count({ where }),
    ]);
    return { dados, total, pagina: q.pagina, limite: q.limite };
  }

  buscar(id: string) {
    return this.prisma.pessoa.findUniqueOrThrow({ where: { id } });
  }

  async criar({ senha, ...dto }: CriarPessoaDto, usuarioId: string) {
    const senha_hash = await hashSenha(senha);
    return this.prisma.$transaction(async (tx) => {
      const novo = await tx.pessoa.create({ data: { ...dto, senha_hash } });
      await this.auditoria.registrar(tx, { usuarioId, tabela: TABELA, novo });
      return novo;
    });
  }

  atualizar(id: string, dto: AtualizarPessoaDto, usuarioId: string) {
    return this.prisma.$transaction(async (tx) => {
      const antigo = await tx.pessoa.findUniqueOrThrow({ where: { id } });
      const novo = await tx.pessoa.update({ where: { id }, data: dto });
      if (dto.ativo === false) {
        await tx.refresh_token.updateMany({
          where: { pessoa_id: id, revogado_em: null },
          data: { revogado_em: new Date() },
        });
      }
      await this.auditoria.registrar(tx, {
        usuarioId,
        tabela: TABELA,
        antigo,
        novo,
      });
      return novo;
    });
  }

  /** Pessoas são referenciadas por decisões e auditoria: desativa em vez de apagar. */
  desativar(id: string, usuarioId: string) {
    return this.atualizar(id, { ativo: false }, usuarioId);
  }
}
