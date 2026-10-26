import { Controller, Get, Query } from '@nestjs/common';
import { DashboardQueryDto } from './dashboard.dto.js';
import { DashboardService } from './dashboard.service.js';

// Leitura para qualquer usuário autenticado, como a listagem de ativos.
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  resumo(@Query() query: DashboardQueryDto) {
    return this.dashboard.resumo(query);
  }
}
