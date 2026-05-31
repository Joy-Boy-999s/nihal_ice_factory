import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { JwtAuthGuard } from '../jwt-auth.guard';
import {
  IceSizeConversionService,
  ConversionInput,
} from './ice-size-conversion.service';

interface JwtUser { userId: string; username: string; role: string; }
interface AuthenticatedRequest { user: JwtUser; }

@ApiTags('IceSizeConversion')
@Controller('ice-conversion')
@UseGuards(JwtAuthGuard)
export class IceSizeConversionController {
  constructor(private readonly service: IceSizeConversionService) {}

  private ensureAdmin(user: JwtUser): void {
    if (String(user?.role || '').toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Size conversion management is restricted to admin users.');
    }
  }

  @Get('all')
  @ApiOperation({ summary: 'Get all pairwise size conversions (authenticated)' })
  @ApiResponse({ status: 200, type: CommonResponse })
  async getAll(): Promise<CommonResponse> {
    return this.service.getAll();
  }

  @Post('save-all')
  @ApiOperation({ summary: 'Replace all conversions with the provided list (Admin only)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        conversions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              fromTypeName: { type: 'string' },
              toTypeName:   { type: 'string' },
              factor:       { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, type: CommonResponse })
  async saveAll(
    @Body() body: { conversions: ConversionInput[] },
    @Req() req: AuthenticatedRequest,
  ): Promise<CommonResponse> {
    this.ensureAdmin(req.user);
    return this.service.saveAll(body.conversions ?? []);
  }
}
