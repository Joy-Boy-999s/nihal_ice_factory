import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Observable, from, interval, merge, of } from 'rxjs';
import { catchError, map, startWith, switchMap } from 'rxjs/operators';

import { InventoryService } from './inventory.service';
import { CommonResponse } from '@nihal-ice-factory/shared-models';
import { CreateBatchDto } from './dto/create-batch.dto';
import { SellSlotsDto } from './dto/sell-slots.dto';
import { ReserveSlotsDto, ReleaseSlotsDto } from './dto/reserve-slots.dto';
import { MarkDamagedDto } from './dto/mark-damaged.dto';
import { FulfillOrderDto } from './dto/fulfill-order.dto';
import { MarkBatchReadyDto, SetNextBatchDto } from './dto/batch-actions.dto';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { GetUser, JwtUser } from '../decorators/get-user.decorator';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ── Batches ──────────────────────────────────────────────────────────────

  @Post('batches/create')
  @ApiOperation({ summary: 'Create a new ice batch and generate its slot grid' })
  @ApiBody({ type: CreateBatchDto })
  async createBatch(
    @Body() dto: CreateBatchDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.inventoryService.createBatch(dto, user.userId, user.role === 'ADMIN');
  }

  @Get('batches/list')
  @ApiOperation({ summary: 'List batches (scoped to accessible plants)' })
  @ApiQuery({ name: 'plantUnit', required: false })
  async listBatches(
    @Query('plantUnit') plantUnit: string | undefined,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.inventoryService.listBatches(plantUnit, user.userId, user.role === 'ADMIN');
  }

  @Get('batches/:batchId/grid')
  @ApiOperation({ summary: 'Get the full slot grid for a batch (cinema-seat style)' })
  @ApiParam({ name: 'batchId', type: Number })
  async getBatchGrid(
    @Param('batchId', ParseIntPipe) batchId: number,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.inventoryService.getBatchGrid(batchId, user.userId, user.role === 'ADMIN');
  }

  @Put('batches/:batchId/markReady')
  @ApiOperation({ summary: 'Mark a batch as ready (ice is out of moulds)' })
  @ApiParam({ name: 'batchId', type: Number })
  @ApiBody({ type: MarkBatchReadyDto })
  async markBatchReady(
    @Param('batchId', ParseIntPipe) batchId: number,
    @Body() dto: MarkBatchReadyDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.inventoryService.markBatchReady(batchId, dto, user.userId, user.role === 'ADMIN');
  }

  @Put('batches/:batchId/setNextBatch')
  @ApiOperation({ summary: 'Set countdown to when the next batch will be ready' })
  @ApiParam({ name: 'batchId', type: Number })
  @ApiBody({ type: SetNextBatchDto })
  async setNextBatch(
    @Param('batchId', ParseIntPipe) batchId: number,
    @Body() dto: SetNextBatchDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.inventoryService.setNextBatch(batchId, dto, user.userId, user.role === 'ADMIN');
  }

  // ── Slots ────────────────────────────────────────────────────────────────

  @Post('slots/sell')
  @ApiOperation({ summary: 'Sell selected ice slots — triggers sale creation + marks slots sold' })
  @ApiBody({ type: SellSlotsDto })
  async sellSlots(
    @Body() dto: SellSlotsDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.inventoryService.sellSlots(dto, user.userId, user.role === 'ADMIN');
  }

  @Post('slots/reserve')
  @ApiOperation({ summary: 'Reserve slots for a customer (auto-expires)' })
  @ApiBody({ type: ReserveSlotsDto })
  async reserveSlots(
    @Body() dto: ReserveSlotsDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.inventoryService.reserveSlots(dto, user.userId, user.role === 'ADMIN');
  }

  @Post('slots/release')
  @ApiOperation({ summary: 'Release reserved slots back to available' })
  @ApiBody({ type: ReleaseSlotsDto })
  async releaseSlots(
    @Body() dto: ReleaseSlotsDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.inventoryService.releaseSlots(dto, user.userId, user.role === 'ADMIN');
  }

  @Post('slots/fulfill')
  @ApiOperation({ summary: 'Fulfill a customer order — selected slots are sold against the order (strict match)' })
  @ApiBody({ type: FulfillOrderDto })
  async fulfillOrder(
    @Body() dto: FulfillOrderDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.inventoryService.fulfillOrder(dto, user.userId, user.username, user.role === 'ADMIN');
  }

  @Post('slots/markDamaged')
  @ApiOperation({ summary: 'Mark slots as damaged (excluded from sales)' })
  @ApiBody({ type: MarkDamagedDto })
  async markDamaged(
    @Body() dto: MarkDamagedDto,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.inventoryService.markDamaged(dto, user.userId, user.role === 'ADMIN');
  }

  // ── Availability & alerts ─────────────────────────────────────────────────

  @Get('availability')
  @ApiOperation({ summary: 'Live availability summary across all accessible plants' })
  async getAvailability(@GetUser() user: JwtUser): Promise<CommonResponse> {
    return this.inventoryService.getAvailabilitySummary(user.userId, user.role === 'ADMIN');
  }

  /**
   * Used by Add Sale form — returns available slot count per iceTypeId for a plant.
   * Response: { iceTypeId, iceTypeName, iceTypeCode, availableCount, totalSlots }[]
   */
  @Get('plant-availability')
  @ApiOperation({ summary: 'Available stock per ice type for a given plant (used by Add Sale)' })
  @ApiQuery({ name: 'plantUnit', required: true })
  async getPlantAvailability(
    @Query('plantUnit') plantUnit: string,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    return this.inventoryService.getPlantAvailabilityForSale(plantUnit, user.userId, user.role === 'ADMIN');
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Batches with available ice that expires within N hours (default 4)' })
  @ApiQuery({ name: 'hours', required: false, example: 4 })
  async getExpiringSoon(
    @Query('hours') hours: string | undefined,
    @GetUser() user: JwtUser,
  ): Promise<CommonResponse> {
    const h = hours ? parseInt(hours, 10) : 4;
    return this.inventoryService.getExpiringSoon(h, user.userId, user.role === 'ADMIN');
  }

  // ── SSE: live inventory stream ────────────────────────────────────────────

  @Sse('stream')
  @ApiOperation({ summary: 'SSE stream — availability snapshot every 10 s + heartbeat every 5 s' })
  streamInventory(@GetUser() user: JwtUser): Observable<MessageEvent> {
    const isAdmin = user.role === 'ADMIN';
    const userId  = user.userId;

    const availability$ = interval(10_000).pipe(
      startWith(0),
      switchMap(() =>
        from(
          Promise.all([
            this.inventoryService.getAvailabilitySummary(userId, isAdmin),
            this.inventoryService.releaseExpiredReservations(),
          ]),
        ).pipe(
          map(([response]): MessageEvent => ({ type: 'inventory', retry: 2000, data: response })),
          catchError((err: Error) =>
            of<MessageEvent>({
              type: 'inventory-error',
              data: new CommonResponse(false, 500, err.message, null),
            }),
          ),
        ),
      ),
    );

    const heartbeat$ = interval(5_000).pipe(
      map((): MessageEvent => ({ type: 'heartbeat', data: { ts: new Date().toISOString() } })),
    );

    return merge(availability$, heartbeat$);
  }

  // ── Admin: expire reservations manually ──────────────────────────────────

  @Post('admin/releaseExpired')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Manually trigger release of all expired reservations (admin only)' })
  @ApiResponse({ status: 200, type: CommonResponse })
  async releaseExpiredReservations(): Promise<CommonResponse> {
    const count = await this.inventoryService.releaseExpiredReservations();
    return new CommonResponse(true, 200, `Released ${count} expired reservation(s)`, { count });
  }
}
