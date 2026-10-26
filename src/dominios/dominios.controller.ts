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
  AtualizarDominioDto,
  CriarDominioDto,
  DominiosQueryDto,
} from './dominios.dto.js';
import { DominiosService } from './dominios.service.js';

@Controller('dominios')
export class DominiosController {
  constructor(private readonly dominios: DominiosService) {}

  @Get()
  listar(@Query() query: DominiosQueryDto) {
    return this.dominios.listar(query);
  }

  @Get(':id')
  buscar(@Param('id', ParseUUIDPipe) id: string) {
    return this.dominios.buscar(id);
  }

  @Roles('Admin')
  @Post()
  criar(@Body() dto: CriarDominioDto, @UsuarioAtual() u: UsuarioAutenticado) {
    return this.dominios.criar(dto, u.id);
  }

  @Roles('Admin')
  @Patch(':id')
  atualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AtualizarDominioDto,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    return this.dominios.atualizar(id, dto, u.id);
  }

  @Roles('Admin')
  @Delete(':id')
  @HttpCode(204)
  async remover(
    @Param('id', ParseUUIDPipe) id: string,
    @UsuarioAtual() u: UsuarioAutenticado,
  ) {
    await this.dominios.remover(id, u.id);
  }
}
