import { Module } from '@nestjs/common';
import { DominiosController } from './dominios.controller.js';
import { DominiosService } from './dominios.service.js';

@Module({
  controllers: [DominiosController],
  providers: [DominiosService],
})
export class DominiosModule {}
