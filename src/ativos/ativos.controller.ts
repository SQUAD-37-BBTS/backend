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
  Put,
  Query,
} from '@nestjs/common';
import {
  Roles,
  UsuarioAtual,
  type UsuarioAutenticado,
} from '../auth/decorators.js';
import { AtivoDetalhesService } from './ativo-detalhes.service.js';
import {
  AtivosQueryDto,
  AtualizarAtivoDto,
  CriarAtivoDto,
  CriarDecisaoDto,
  CriarPapelDto,
  SalvarContextualizacaoDto,
  SalvarEnquadramentoDto,
} from './ativos.dto.js';
import { AtivosService } from './ativos.service.js';

const Id = () => Param('id', ParseUUIDPipe);

@Controller('ativos')
export class AtivosController {
  constructor(
    private readonly ativos: AtivosService,
    private readonly detalhes: AtivoDetalhesService,
  ) {}

  // ---------- Ativo

  @Get()
  listar(@Query() query: AtivosQueryDto) {
    return this.ativos.listar(query);
  }

  @Get(':id')
  buscar(@Id() id: string) {
    return this.ativos.buscar(id);
  }

  @Post()
  criar(@Body() dto: CriarAtivoDto, @UsuarioAtual() u: UsuarioAutenticado) {
    return this.ativos.criar(dto, u.id);
  }

  @Patch(':id')
  atualizar(
    @Id() id: string,
    @Body() dto: AtualizarAtivoDto,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.ativos.atualizar(id, dto, u.id);
  }

  @Roles('Admin')
  @Delete(':id')
  @HttpCode(204)
  async remover(@Id() id: string, @UsuarioAtual() u: UsuarioAutenticado) {
    await this.ativos.remover(id, u.id);
  }

  // ---------- Papéis

  @Get(':id/papeis')
  listarPapeis(@Id() id: string) {
    return this.detalhes.listarPapeis(id);
  }

  @Post(':id/papeis')
  adicionarPapel(
    @Id() id: string,
    @Body() dto: CriarPapelDto,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.detalhes.adicionarPapel(id, dto, u.id);
  }

  @Delete(':id/papeis/:papelId')
  @HttpCode(204)
  async removerPapel(
    @Id() id: string,
    @Param('papelId', ParseUUIDPipe) papelId: string,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    await this.detalhes.removerPapel(id, papelId, u.id);
  }

  // ---------- Contextualização

  @Get(':id/contextualizacao')
  buscarContextualizacao(@Id() id: string) {
    return this.detalhes.buscarContextualizacao(id);
  }

  @Put(':id/contextualizacao')
  salvarContextualizacao(
    @Id() id: string,
    @Body() dto: SalvarContextualizacaoDto,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.detalhes.salvarContextualizacao(id, dto, u.id);
  }

  // ---------- Enquadramento

  @Get(':id/enquadramento')
  buscarEnquadramento(@Id() id: string) {
    return this.detalhes.buscarEnquadramento(id);
  }

  @Roles('Admin')
  @Put(':id/enquadramento')
  salvarEnquadramento(
    @Id() id: string,
    @Body() dto: SalvarEnquadramentoDto,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.detalhes.salvarEnquadramento(id, dto, u.id);
  }

  // ---------- Decisões

  @Get(':id/decisoes')
  listarDecisoes(@Id() id: string) {
    return this.detalhes.listarDecisoes(id);
  }

  @Post(':id/decisoes')
  registrarDecisao(
    @Id() id: string,
    @Body() dto: CriarDecisaoDto,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.detalhes.registrarDecisao(id, dto, u.id);
  }
}
