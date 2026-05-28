import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { IceTypeService } from './ice-price.service';
import { CreateIceTypeDto } from './dto/create-ice-price.dto';
import { UpdateIceTypeDto } from './dto/update-ice-price.dto';

interface JwtUser {
  userId: string;
  username: string;
  role: string;
}

interface AuthenticatedRequest {
  user: JwtUser;
}

@ApiTags('IceType')
@Controller('ice-type')
@UseGuards(JwtAuthGuard)
export class IceTypeController {
  constructor(private readonly iceTypeService: IceTypeService) {}

  private ensureAdmin(user: JwtUser): void {
    if (String(user?.role || '').toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException(
        'Ice type management is restricted to admin users only',
      );
    }
  }

  @Post('create')
  @ApiOperation({ summary: 'Create a new ice type & price entry (Admin only)' })
  @ApiBody({ type: CreateIceTypeDto })
  @ApiResponse({ status: 201, description: 'Ice type created', type: CommonResponse })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  async createIceType(
    @Body() dto: CreateIceTypeDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CommonResponse> {
    this.ensureAdmin(req.user);
    return this.iceTypeService.createIceType(dto);
  }

  @Get('getAll')
  @ApiOperation({ summary: 'Get all ice types (authenticated users)' })
  @ApiResponse({ status: 200, description: 'Ice types fetched', type: CommonResponse })
  async getAllIceTypes(): Promise<CommonResponse> {
    return this.iceTypeService.getAllIceTypes();
  }

  @Get('getById/:id')
  @ApiOperation({ summary: 'Get a specific ice type by ID (Admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Ice type fetched', type: CommonResponse })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getIceTypeById(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<CommonResponse> {
    this.ensureAdmin(req.user);
    return this.iceTypeService.getIceTypeById(id);
  }

  @Put('update/:id')
  @ApiOperation({ summary: 'Update an ice type entry (Admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateIceTypeDto })
  @ApiResponse({ status: 200, description: 'Ice type updated', type: CommonResponse })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async updateIceType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIceTypeDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<CommonResponse> {
    this.ensureAdmin(req.user);
    return this.iceTypeService.updateIceType(id, dto);
  }

  @Delete('delete/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an ice type entry (Admin only)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Ice type deleted', type: CommonResponse })
  @ApiResponse({ status: 403, description: 'Forbidden — admin only' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async deleteIceType(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ): Promise<CommonResponse> {
    this.ensureAdmin(req.user);
    return this.iceTypeService.deleteIceType(id);
  }
}
