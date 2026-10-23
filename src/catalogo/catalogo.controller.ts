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
  AtualizarModeloDto,
  AtualizarTecnologiaDto,
  CriarModeloDto,
  CriarTecnologiaDto,
  ModelosQueryDto,
  TecnologiasQueryDto,
} from './catalogo.dto.js';
import { CatalogoService } from './catalogo.service.js';

const Id = () => Param('id', ParseUUIDPipe);

// Leitura para qualquer usuário autenticado; escrita restrita a Admin.
@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get('modelos')
  listarModelos(@Query() query: ModelosQueryDto) {
    return this.catalogo.listarModelos(query);
  }

  @Get('modelos/:id')
  buscarModelo(@Id() id: string) {
    return this.catalogo.buscarModelo(id);
  }

  @Roles('Admin')
  @Post('modelos')
  criarModelo(
    @Body() dto: CriarModeloDto,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.catalogo.criarModelo(dto, u.id);
  }

  @Roles('Admin')
  @Patch('modelos/:id')
  atualizarModelo(
    @Id() id: string,
    @Body() dto: AtualizarModeloDto,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.catalogo.atualizarModelo(id, dto, u.id);
  }

  @Roles('Admin')
  @Delete('modelos/:id')
  @HttpCode(204)
  async removerModelo(@Id() id: string, @UsuarioAtual() u: UsuarioAutenticado) {
    await this.catalogo.removerModelo(id, u.id);
  }

  @Get('tecnologias')
  listarTecnologias(@Query() query: TecnologiasQueryDto) {
    return this.catalogo.listarTecnologias(query);
  }

  @Get('tecnologias/:id')
  buscarTecnologia(@Id() id: string) {
    return this.catalogo.buscarTecnologia(id);
  }

  @Roles('Admin')
  @Post('tecnologias')
  criarTecnologia(
    @Body() dto: CriarTecnologiaDto,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.catalogo.criarTecnologia(dto, u.id);
  }

  @Roles('Admin')
  @Patch('tecnologias/:id')
  atualizarTecnologia(
    @Id() id: string,
    @Body() dto: AtualizarTecnologiaDto,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.catalogo.atualizarTecnologia(id, dto, u.id);
  }

  @Roles('Admin')
  @Delete('tecnologias/:id')
  @HttpCode(204)
  async removerTecnologia(
    @Id() id: string,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    await this.catalogo.removerTecnologia(id, u.id);
  }
}
