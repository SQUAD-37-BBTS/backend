import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  Roles,
  UsuarioAtual,
  type UsuarioAutenticado,
} from '../auth/decorators.js';
import {
  AtualizarPessoaDto,
  CriarPessoaDto,
  PessoasQueryDto,
} from './pessoas.dto.js';
import { PessoasService } from './pessoas.service.js';

@Controller('pessoas')
export class PessoasController {
  constructor(private readonly pessoas: PessoasService) {}

  // Leitura liberada a qualquer usuário autenticado (necessária para
  // escolher responsáveis/owners nas telas).
  @Get()
  listar(@Query() query: PessoasQueryDto) {
    return this.pessoas.listar(query);
  }

  @Get(':id')
  buscar(@Param('id', ParseUUIDPipe) id: string) {
    return this.pessoas.buscar(id);
  }

  @Roles('Admin')
  @Post()
  criar(@Body() dto: CriarPessoaDto, @UsuarioAtual() u: UsuarioAutenticado) {
    return this.pessoas.criar(dto, u.id);
  }

  @Roles('Admin')
  @Patch(':id')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarPessoaDto,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.pessoas.atualizar(id, dto, u.id);
  }

  @Roles('Admin')
  @Delete(':id')
  @HttpCode(204)
  async desativar(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    await this.pessoas.desativar(id, u.id);
  }
}
