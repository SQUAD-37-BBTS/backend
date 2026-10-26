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
  ResponderRecomendacaoDto,
  SalvarContextualizacaoDto,
  SalvarEnquadramentoDto,
} from './ativos.dto.js';
import { AtivosService } from './ativos.service.js';
import { RecomendacaoService } from './recomendacao.service.js';
import { SugestaoIaService } from './sugestao-ia.service.js';

const Id = () => Param('id', ParseUUIDPipe);

@Controller('ativos')
export class AtivosController {
  constructor(
    private readonly ativos: AtivosService,
    private readonly detalhes: AtivoDetalhesService,
    private readonly recomendacao: RecomendacaoService,
    private readonly sugestaoIa: SugestaoIaService,
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
    return this.ativos.atualizar(id, dto, u);
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
    return this.detalhes.adicionarPapel(id, dto, u);
  }

  @Delete(':id/papeis/:papelId')
  @HttpCode(204)
  async removerPapel(
    @Id() id: string,
    @Param('papelId', ParseUUIDPipe) papelId: string,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    await this.detalhes.removerPapel(id, papelId, u);
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
    return this.detalhes.salvarContextualizacao(id, dto, u);
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
    return this.detalhes.registrarDecisao(id, dto, u);
  }

  // ---------- IA (sugestão e recomendação; a decisão é sempre humana)

  /** Sugestões para o questionário; nada é gravado até o usuário salvar. */
  @Post(':id/sugestao-ia')
  @HttpCode(200)
  sugerir(@Id() id: string, @UsuarioAtual() u: UsuarioAutenticado) {
    return this.sugestaoIa.sugerir(id, u);
  }

  @Get(':id/recomendacao')
  buscarRecomendacao(@Id() id: string) {
    return this.recomendacao.buscar(id);
  }

  @Post(':id/recomendacao')
  responderRecomendacao(
    @Id() id: string,
    @Body() dto: ResponderRecomendacaoDto,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.recomendacao.responder(id, dto, u);
  }
}
