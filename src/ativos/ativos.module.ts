import { Module } from '@nestjs/common';
import { AtivoDetalhesService } from './ativo-detalhes.service.js';
import { AtivosController } from './ativos.controller.js';
import { AtivosService } from './ativos.service.js';

@Module({
  controllers: [AtivosController],
  providers: [AtivosService, AtivoDetalhesService],
})
export class AtivosModule {}
