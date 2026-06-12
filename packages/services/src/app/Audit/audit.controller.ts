import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Recent audit trail of sensitive actions (admin only)' })
  @ApiQuery({ name: 'limit', required: false, example: 200 })
  async list(@Query('limit') limit?: string): Promise<CommonResponse> {
    return this.auditService.list(limit ? parseInt(limit, 10) : 200);
  }
}
