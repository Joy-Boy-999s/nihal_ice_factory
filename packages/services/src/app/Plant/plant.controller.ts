import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { PlantService } from './plant.service';
import { CreatePlantDto } from './dto/create-plant.dto';
import { UpdatePlantDto } from './dto/update-plant.dto';
import { AssignPlantAccessDto } from './dto/assign-plant-access.dto';
import { CommonResponseModel } from '@nihal-ice-factory/backend-utils';

/** Shape the JWT strategy puts on req.user */
interface JwtUser {
  userId: string;
  username: string;
  role: string;
}

interface AuthRequest {
  user: JwtUser;
}

@ApiTags('plants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('plants')
export class PlantController {
  constructor(private readonly plantService: PlantService) {}

  // ── POST /plants/create ────────────────────────────────────────────────────

  @Post('create')
  @ApiOperation({ summary: 'Create a new plant' })
  async create(@Body() dto: CreatePlantDto): Promise<CommonResponseModel> {
    try {
      const plant = await this.plantService.create(dto);
      return new CommonResponseModel(true, 1, 'Plant created successfully', plant as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to create plant';
      return new CommonResponseModel(false, 0, msg);
    }
  }

  // ── GET /plants/getAll ─────────────────────────────────────────────────────

  @Get('getAll')
  @ApiOperation({ summary: 'Get all plants (active + inactive) — admin use' })
  async getAll(): Promise<CommonResponseModel> {
    try {
      const plants = await this.plantService.getAll();
      return new CommonResponseModel(true, 1, 'Plants fetched successfully', plants as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch plants';
      return new CommonResponseModel(false, 0, msg);
    }
  }

  // ── GET /plants/getActive ─────────────────────────────────────────────────
  // Role-aware: ADMIN → all active; USER → only assigned plants.

  @Get('getActive')
  @ApiOperation({ summary: 'Get active plants visible to the current user' })
  async getActive(@Req() req: AuthRequest): Promise<CommonResponseModel> {
    try {
      const isAdmin = req.user.role === 'ADMIN';
      const plants  = await this.plantService.getAccessible(req.user.userId, isAdmin);
      return new CommonResponseModel(true, 1, 'Active plants fetched', plants as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch plants';
      return new CommonResponseModel(false, 0, msg);
    }
  }

  // ── GET /plants/getById/:id ───────────────────────────────────────────────

  @Get('getById/:id')
  @ApiOperation({ summary: 'Get a plant by id' })
  async getById(@Param('id', ParseIntPipe) id: number): Promise<CommonResponseModel> {
    try {
      const plant = await this.plantService.getById(id);
      return new CommonResponseModel(true, 1, 'Plant fetched', plant as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Plant not found';
      return new CommonResponseModel(false, 0, msg);
    }
  }

  // ── PUT /plants/update/:id ────────────────────────────────────────────────

  @Put('update/:id')
  @ApiOperation({ summary: 'Update a plant' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlantDto,
  ): Promise<CommonResponseModel> {
    try {
      const plant = await this.plantService.update(id, dto);
      return new CommonResponseModel(true, 1, 'Plant updated successfully', plant as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update plant';
      return new CommonResponseModel(false, 0, msg);
    }
  }

  // ── DELETE /plants/delete/:id ─────────────────────────────────────────────

  @Delete('delete/:id')
  @ApiOperation({ summary: 'Delete a plant (also clears all access records)' })
  async delete(@Param('id', ParseIntPipe) id: number): Promise<CommonResponseModel> {
    try {
      await this.plantService.delete(id);
      return new CommonResponseModel(true, 1, 'Plant deleted successfully');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete plant';
      return new CommonResponseModel(false, 0, msg);
    }
  }

  // ── POST /plants/access/assign ────────────────────────────────────────────

  @Post('access/assign')
  @ApiOperation({ summary: 'Grant a user access to a plant (admin only)' })
  async assignAccess(@Body() dto: AssignPlantAccessDto): Promise<CommonResponseModel> {
    try {
      const access = await this.plantService.assignAccess(dto);
      return new CommonResponseModel(true, 1, 'Access granted', access as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to grant access';
      return new CommonResponseModel(false, 0, msg);
    }
  }

  // ── DELETE /plants/access/revoke/:userId/:plantId ─────────────────────────

  @Delete('access/revoke/:userId/:plantId')
  @ApiOperation({ summary: "Revoke a user's access to a plant (admin only)" })
  async revokeAccess(
    @Param('userId') userId: string,
    @Param('plantId', ParseIntPipe) plantId: number,
  ): Promise<CommonResponseModel> {
    try {
      await this.plantService.revokeAccess(userId, plantId);
      return new CommonResponseModel(true, 1, 'Access revoked');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to revoke access';
      return new CommonResponseModel(false, 0, msg);
    }
  }

  // ── GET /plants/access/users/:plantId ─────────────────────────────────────

  @Get('access/users/:plantId')
  @ApiOperation({ summary: 'List all users who have access to a plant (admin only)' })
  async getUsersForPlant(
    @Param('plantId', ParseIntPipe) plantId: number,
  ): Promise<CommonResponseModel> {
    try {
      const rows = await this.plantService.getUsersForPlant(plantId);
      return new CommonResponseModel(true, 1, 'Access list fetched', rows as never);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch access list';
      return new CommonResponseModel(false, 0, msg);
    }
  }
}
