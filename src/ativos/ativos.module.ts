import { Module } from '@nestjs/common';
import { AtivoDetalhesService } from './ativo-detalhes.service.js';
import { AtivosController } from './ativos.controller.js';
import { AtivosService } from './ativos.service.js';
import { RecomendacaoService } from './recomendacao.service.js';
import { SugestaoIaService } from './sugestao-ia.service.js';

@Module({
  controllers: [AtivosController],
  providers: [
    AtivosService,
    AtivoDetalhesService,
    RecomendacaoService,
    SugestaoIaService,
  ],
})
export class AtivosModule {}
