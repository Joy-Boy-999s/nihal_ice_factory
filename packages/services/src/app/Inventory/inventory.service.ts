import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { In } from 'typeorm';
import { CommonResponse } from '@nihal-ice-factory/shared-models';

import { IceBatchRepository } from './repository/ice-batch.repository';
import { IceSlotRepository } from './repository/ice-slot.repository';
import { IceBatch, BatchStatus } from './entities/ice-batch.entity';
import { IceSlot } from './entities/ice-slot.entity';
import { CreateBatchDto } from './dto/create-batch.dto';
import { SellSlotsDto } from './dto/sell-slots.dto';
import { ReserveSlotsDto, ReleaseSlotsDto } from './dto/reserve-slots.dto';
import { MarkDamagedDto } from './dto/mark-damaged.dto';
import { MarkBatchReadyDto, SetNextBatchDto } from './dto/batch-actions.dto';
import { IceTypeService } from '../IcePrice/ice-price.service';
import { PlantService } from '../Plant/plant.service';
import { SalesRepository } from '../Sales/repository/sales.repository';
import { GenericTransactionManager } from '../../database/trasanction-manager';
import { NotificationService } from '../Notification/notification.service';

/** Converts a numeric row index to a letter label: 0→A, 1→B, …, 25→Z, 26→AA */
function rowLabel(row: number): string {
  let label = '';
  let n = row;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly batchRepo: IceBatchRepository,
    private readonly slotRepo: IceSlotRepository,
    private readonly iceTypeService: IceTypeService,
    private readonly plantService: PlantService,
    private readonly salesRepo: SalesRepository,
    private readonly txManager: GenericTransactionManager,
    private readonly notificationService: NotificationService,
  ) {}

  // ── Plant access helpers ────────────────────────────────────────────────────

  private async getAccessiblePlantNames(userId: string): Promise<string[]> {
    const plants = await this.plantService.getAccessible(userId, false);
    return plants.map((p) => p.plantName);
  }

  private async checkPlantAccess(
    plantUnit: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse | null> {
    if (isAdmin) return null;
    const names = await this.getAccessiblePlantNames(userId);
    if (!names.includes(plantUnit)) {
      return new CommonResponse(false, 403, `Access denied: not assigned to plant "${plantUnit}"`, null);
    }
    return null;
  }

  // ── Batch: create ──────────────────────────────────────────────────────────

  async createBatch(
    dto: CreateBatchDto,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    const denied = await this.checkPlantAccess(dto.plantUnit, userId, isAdmin);
    if (denied) return denied;

    await this.txManager.startTransaction();
    try {
      const batchTx = this.txManager.getRepository(this.batchRepo);
      const slotTx  = this.txManager.getRepository(this.slotRepo);

      // Resolve ice type for snapshot.
      const activeTypes = await this.iceTypeService.getActiveByPlant(dto.plantUnit);
      const iceType = activeTypes.find((t) => t.id === dto.iceTypeId);
      if (!iceType) {
        throw new BadRequestException(
          `Ice type ID ${dto.iceTypeId} not found or inactive for plant "${dto.plantUnit}"`,
        );
      }

      const totalSlots = dto.rows * dto.cols;
      const readyAt    = dto.readyAt ? new Date(dto.readyAt) : null;
      const shelfHrs   = dto.shelfLifeHours ?? 24;
      const expiresAt  = readyAt ? new Date(readyAt.getTime() + shelfHrs * 3_600_000) : null;

      const batch = batchTx.create({
        plantUnit:           dto.plantUnit,
        iceTypeId:           iceType.id,
        iceTypeName:         iceType.iceTypeName,
        iceTypeCode:         iceType.iceTypeCode,
        batchLabel:          dto.batchLabel,
        rows:                dto.rows,
        cols:                dto.cols,
        totalSlots,
        availableCount:      totalSlots,
        soldCount:           0,
        reservedCount:       0,
        damagedCount:        0,
        status:              readyAt && readyAt <= new Date() ? 'ready' : 'in_production' as BatchStatus,
        productionStartedAt: dto.productionStartedAt ? new Date(dto.productionStartedAt) : new Date(),
        readyAt,
        expiresAt,
        notes:               dto.notes ?? null,
        createdBy:           userId,
      });

      const savedBatch = await batchTx.save(batch);

      // Build all slots in one bulk insert.
      const slots: Partial<IceSlot>[] = [];
      for (let r = 0; r < dto.rows; r++) {
        for (let c = 0; c < dto.cols; c++) {
          slots.push({
            batchId:    savedBatch.id,
            plantUnit:  dto.plantUnit,
            rowNumber:  r,
            colNumber:  c,
            slotLabel:  `${rowLabel(r)}${c + 1}`,
            status:     'available',
          });
        }
      }
      await slotTx.save(slots as IceSlot[]);

      await this.txManager.commitTransaction();
      return new CommonResponse(true, 201, 'Batch created successfully', savedBatch);
    } catch (err) {
      await this.txManager.rollbackTransaction();
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, err instanceof BadRequestException ? 400 : 500, msg, null);
    }
  }

  // ── Batch: list ───────────────────────────────────────────────────────────

  async listBatches(
    plantUnit: string | undefined,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    try {
      let plant = plantUnit;

      if (plant) {
        const denied = await this.checkPlantAccess(plant, userId, isAdmin);
        if (denied) return denied;
      }

      let batches: IceBatch[];

      if (plant) {
        batches = await this.batchRepo.find({
          where: { plantUnit: plant },
          order: { createdAt: 'DESC' },
        });
      } else if (isAdmin) {
        batches = await this.batchRepo.find({ order: { createdAt: 'DESC' } });
      } else {
        const names = await this.getAccessiblePlantNames(userId);
        if (names.length === 0) return new CommonResponse(true, 200, 'Batches fetched', []);
        batches = await this.batchRepo.find({
          where: { plantUnit: In(names) },
          order: { createdAt: 'DESC' },
        });
      }

      return new CommonResponse(true, 200, 'Batches fetched successfully', batches);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, 500, msg, null);
    }
  }

  // ── Batch: grid view ──────────────────────────────────────────────────────

  async getBatchGrid(
    batchId: number,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    try {
      const batch = await this.batchRepo.findOne({ where: { id: batchId } });
      if (!batch) throw new NotFoundException(`Batch #${batchId} not found`);

      const denied = await this.checkPlantAccess(batch.plantUnit, userId, isAdmin);
      if (denied) return denied;

      const slots = await this.slotRepo.find({
        where: { batchId },
        order: { rowNumber: 'ASC', colNumber: 'ASC' },
      });

      // Build a 2-D grid: rows[r][c] = slot.
      const grid: IceSlot[][] = Array.from({ length: batch.rows }, () =>
        new Array(batch.cols).fill(null),
      );
      for (const slot of slots) {
        grid[slot.rowNumber][slot.colNumber] = slot;
      }

      const now = new Date();
      return new CommonResponse(true, 200, 'Batch grid fetched', {
        batch,
        grid,
        isExpired:    batch.expiresAt ? now > batch.expiresAt : false,
        isNearExpiry: batch.expiresAt
          ? now > new Date(batch.expiresAt.getTime() - 2 * 3_600_000) && now <= batch.expiresAt
          : false,
        nextBatchCountdownMs: batch.estimatedNextBatchAt
          ? Math.max(0, batch.estimatedNextBatchAt.getTime() - now.getTime())
          : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, err instanceof NotFoundException ? 404 : 500, msg, null);
    }
  }

  // ── Batch: mark ready ─────────────────────────────────────────────────────

  async markBatchReady(
    batchId: number,
    dto: MarkBatchReadyDto,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    try {
      const batch = await this.batchRepo.findOne({ where: { id: batchId } });
      if (!batch) throw new NotFoundException(`Batch #${batchId} not found`);

      const denied = await this.checkPlantAccess(batch.plantUnit, userId, isAdmin);
      if (denied) return denied;

      const readyAt   = dto.readyAt ? new Date(dto.readyAt) : new Date();
      const shelfHrs  = dto.shelfLifeHours ?? 24;
      const expiresAt = new Date(readyAt.getTime() + shelfHrs * 3_600_000);

      batch.status    = 'ready';
      batch.readyAt   = readyAt;
      batch.expiresAt = expiresAt;
      const saved = await this.batchRepo.save(batch);

      return new CommonResponse(true, 200, 'Batch marked as ready', saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, err instanceof NotFoundException ? 404 : 500, msg, null);
    }
  }

  // ── Batch: set next-batch countdown ───────────────────────────────────────

  async setNextBatch(
    batchId: number,
    dto: SetNextBatchDto,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    try {
      const batch = await this.batchRepo.findOne({ where: { id: batchId } });
      if (!batch) throw new NotFoundException(`Batch #${batchId} not found`);

      const denied = await this.checkPlantAccess(batch.plantUnit, userId, isAdmin);
      if (denied) return denied;

      batch.estimatedNextBatchAt = new Date(dto.estimatedNextBatchAt);
      if (dto.notes) batch.notes = dto.notes;
      const saved = await this.batchRepo.save(batch);

      return new CommonResponse(true, 200, 'Next batch time set', saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, err instanceof NotFoundException ? 404 : 500, msg, null);
    }
  }

  // ── Slots: sell ───────────────────────────────────────────────────────────

  async sellSlots(
    dto: SellSlotsDto,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    await this.txManager.startTransaction();
    try {
      const slotTx  = this.txManager.getRepository(this.slotRepo);
      const batchTx = this.txManager.getRepository(this.batchRepo);
      const saleTx  = this.txManager.getRepository(this.salesRepo);

      const slots = await slotTx.find({ where: { id: In(dto.slotIds) } });
      if (slots.length !== dto.slotIds.length) {
        throw new BadRequestException('One or more slot IDs not found');
      }

      // Verify all slots belong to the same plant and user has access.
      const plants = [...new Set(slots.map((s) => s.plantUnit))];
      if (plants.length > 1) {
        throw new BadRequestException('Cannot sell slots from multiple plants in one transaction');
      }
      const plantUnit = plants[0];

      const denied = await this.checkPlantAccess(plantUnit, userId, isAdmin);
      if (denied) {
        await this.txManager.rollbackTransaction();
        return denied;
      }

      // Validate all slots are sellable.
      for (const slot of slots) {
        if (slot.status === 'sold') {
          throw new BadRequestException(`Slot ${slot.slotLabel} (ID ${slot.id}) is already sold`);
        }
        if (slot.status === 'damaged') {
          throw new BadRequestException(`Slot ${slot.slotLabel} (ID ${slot.id}) is damaged and cannot be sold`);
        }
      }

      // Resolve ice type info from the batch for the sale snapshot.
      const batchIds   = [...new Set(slots.map((s) => s.batchId))];
      const batches    = await batchTx.find({ where: { id: In(batchIds) } });
      const batchMap   = new Map(batches.map((b) => [b.id, b]));
      const activeTypes = await this.iceTypeService.getActiveByPlant(plantUnit);
      const typeMap    = new Map(activeTypes.map((t) => [t.id, t]));

      // Build sale items grouped by ice type.
      const itemMap = new Map<number, { iceTypeName: string; iceTypeCode: string; price: number; quantity: number }>();
      for (const slot of slots) {
        const batch   = batchMap.get(slot.batchId)!;
        const iceType = typeMap.get(batch.iceTypeId);
        if (!iceType) throw new BadRequestException(`Ice type for batch #${slot.batchId} not active`);

        const existing = itemMap.get(iceType.id);
        if (existing) {
          existing.quantity += 1;
        } else {
          itemMap.set(iceType.id, {
            iceTypeName: iceType.iceTypeName,
            iceTypeCode: iceType.iceTypeCode,
            price:       Number(iceType.price),
            quantity:    1,
          });
        }
      }

      const snapshots = [...itemMap.entries()].map(([iceTypeId, item]) => ({
        iceTypeId,
        iceTypeName: item.iceTypeName,
        iceTypeCode: item.iceTypeCode,
        quantity:    item.quantity,
        price:       item.price,
        subtotal:    item.quantity * item.price,
      }));

      const discount    = dto.discount ?? 0;
      const totalUnits  = snapshots.reduce((s, i) => s + i.quantity, 0);
      const totalAmount = Math.max(0, snapshots.reduce((s, i) => s + i.subtotal, 0) - discount);

      const now       = new Date();
      const dateStr   = dto.date ?? now.toISOString().split('T')[0];
      const timeStr   = dto.time ?? now.toTimeString().slice(0, 5);

      const sale = saleTx.create({
        date:        dateStr,
        time:        timeStr,
        unit:        plantUnit,
        name:        dto.customerName,
        mobile:      dto.customerMobile,
        shop:        dto.shopName ?? '',
        soldBy:      dto.soldBy,
        discount,
        items:       snapshots,
        totalUnits,
        totalAmount,
      });
      const savedSale = await saleTx.save(sale);

      // Update slots → sold.
      const soldAt = now;
      for (const slot of slots) {
        slot.status = 'sold';
        slot.saleId = savedSale.id;
        slot.soldAt = soldAt;
        slot.soldBy = dto.soldBy;
      }
      await slotTx.save(slots);

      // Update each batch's counts.
      for (const batch of batches) {
        await this.recalcBatchCounts(batch, slotTx, batchTx);
      }

      await this.txManager.commitTransaction();
      return new CommonResponse(true, 201, 'Slots sold and sale created', { sale: savedSale, slots });
    } catch (err) {
      await this.txManager.rollbackTransaction();
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, err instanceof BadRequestException ? 400 : 500, msg, null);
    }
  }

  // ── Slots: reserve ────────────────────────────────────────────────────────

  async reserveSlots(
    dto: ReserveSlotsDto,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    try {
      const slots = await this.slotRepo.find({ where: { id: In(dto.slotIds) } });
      if (slots.length !== dto.slotIds.length) {
        throw new BadRequestException('One or more slot IDs not found');
      }

      const plants = [...new Set(slots.map((s) => s.plantUnit))];
      const denied = await this.checkPlantAccess(plants[0], userId, isAdmin);
      if (denied) return denied;

      const unavailable = slots.filter((s) => s.status !== 'available');
      if (unavailable.length) {
        throw new BadRequestException(
          `Slots not available: ${unavailable.map((s) => s.slotLabel).join(', ')}`,
        );
      }

      const expiryMinutes  = dto.expiresInMinutes ?? 30;
      const reservedUntil  = new Date(Date.now() + expiryMinutes * 60_000);

      for (const slot of slots) {
        slot.status        = 'reserved';
        slot.reservedFor   = dto.reservedFor;
        slot.reservedUntil = reservedUntil;
      }
      const saved = await this.slotRepo.save(slots);

      // Update batch counts for each affected batch.
      const batchIds = [...new Set(slots.map((s) => s.batchId))];
      for (const batchId of batchIds) {
        const batch = await this.batchRepo.findOne({ where: { id: batchId } });
        if (batch) await this.recalcBatchCounts(batch, this.slotRepo, this.batchRepo);
      }

      return new CommonResponse(true, 200, `${saved.length} slot(s) reserved until ${reservedUntil.toISOString()}`, saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, err instanceof BadRequestException ? 400 : 500, msg, null);
    }
  }

  // ── Slots: release reservation ────────────────────────────────────────────

  async releaseSlots(
    dto: ReleaseSlotsDto,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    try {
      const slots = await this.slotRepo.find({ where: { id: In(dto.slotIds) } });
      if (!slots.length) throw new NotFoundException('No matching slots found');

      const plants = [...new Set(slots.map((s) => s.plantUnit))];
      const denied = await this.checkPlantAccess(plants[0], userId, isAdmin);
      if (denied) return denied;

      for (const slot of slots) {
        if (slot.status === 'reserved') {
          slot.status        = 'available';
          slot.reservedFor   = null;
          slot.reservedUntil = null;
        }
      }
      const saved = await this.slotRepo.save(slots);

      const batchIds = [...new Set(slots.map((s) => s.batchId))];
      for (const batchId of batchIds) {
        const batch = await this.batchRepo.findOne({ where: { id: batchId } });
        if (batch) await this.recalcBatchCounts(batch, this.slotRepo, this.batchRepo);
      }

      return new CommonResponse(true, 200, 'Reservations released', saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, err instanceof NotFoundException ? 404 : 500, msg, null);
    }
  }

  // ── Slots: mark damaged ───────────────────────────────────────────────────

  async markDamaged(
    dto: MarkDamagedDto,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    try {
      const slots = await this.slotRepo.find({ where: { id: In(dto.slotIds) } });
      if (!slots.length) throw new NotFoundException('No matching slots found');

      const plants = [...new Set(slots.map((s) => s.plantUnit))];
      const denied = await this.checkPlantAccess(plants[0], userId, isAdmin);
      if (denied) return denied;

      for (const slot of slots) {
        if (slot.status !== 'sold') {
          slot.status     = 'damaged';
          slot.damageNote = dto.damageNote ?? null;
        }
      }
      const saved = await this.slotRepo.save(slots);

      const batchIds = [...new Set(slots.map((s) => s.batchId))];
      for (const batchId of batchIds) {
        const batch = await this.batchRepo.findOne({ where: { id: batchId } });
        if (batch) await this.recalcBatchCounts(batch, this.slotRepo, this.batchRepo);
      }

      return new CommonResponse(true, 200, 'Slots marked as damaged', saved);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, err instanceof NotFoundException ? 404 : 500, msg, null);
    }
  }

  // ── Availability summary ──────────────────────────────────────────────────

  async getAvailabilitySummary(userId: string, isAdmin: boolean): Promise<CommonResponse> {
    try {
      let batches: IceBatch[];
      if (isAdmin) {
        batches = await this.batchRepo.find({ order: { plantUnit: 'ASC', createdAt: 'DESC' } });
      } else {
        const names = await this.getAccessiblePlantNames(userId);
        if (!names.length) return new CommonResponse(true, 200, 'Availability fetched', []);
        batches = await this.batchRepo.find({
          where: { plantUnit: In(names) },
          order: { plantUnit: 'ASC', createdAt: 'DESC' },
        });
      }

      const now = new Date();
      const summary = batches.map((b) => ({
        batchId:              b.id,
        plantUnit:            b.plantUnit,
        batchLabel:           b.batchLabel,
        iceTypeName:          b.iceTypeName,
        status:               b.status,
        availableCount:       b.availableCount,
        reservedCount:        b.reservedCount,
        soldCount:            b.soldCount,
        damagedCount:         b.damagedCount,
        totalSlots:           b.totalSlots,
        readyAt:              b.readyAt,
        expiresAt:            b.expiresAt,
        isExpired:            b.expiresAt ? now > b.expiresAt : false,
        isNearExpiry:         b.expiresAt
          ? now > new Date(b.expiresAt.getTime() - 2 * 3_600_000) && now <= b.expiresAt
          : false,
        nextBatchCountdownMs: b.estimatedNextBatchAt
          ? Math.max(0, b.estimatedNextBatchAt.getTime() - now.getTime())
          : null,
      }));

      return new CommonResponse(true, 200, 'Availability fetched', summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, 500, msg, null);
    }
  }

  // ── Expiring soon ─────────────────────────────────────────────────────────

  async getExpiringSoon(
    hoursAhead: number,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    try {
      const now      = new Date();
      const deadline = new Date(now.getTime() + hoursAhead * 3_600_000);

      let batches: IceBatch[];
      if (isAdmin) {
        batches = await this.batchRepo.find();
      } else {
        const names = await this.getAccessiblePlantNames(userId);
        if (!names.length) return new CommonResponse(true, 200, 'Expiring batches', []);
        batches = await this.batchRepo.find({ where: { plantUnit: In(names) } });
      }

      const expiring = batches.filter(
        (b) => b.expiresAt && b.expiresAt > now && b.expiresAt <= deadline && b.availableCount > 0,
      );

      return new CommonResponse(true, 200, 'Expiring batches fetched', expiring);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, 500, msg, null);
    }
  }

  // ── Plant-level availability for Add Sale form ────────────────────────────

  /**
   * Aggregates available slot counts per iceTypeId for a given plant.
   * The Add Sale form uses this to show stock levels and enforce out-of-stock.
   */
  async getPlantAvailabilityForSale(
    plantUnit: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    try {
      const denied = await this.checkPlantAccess(plantUnit, userId, isAdmin);
      if (denied) return denied;

      const batches = await this.batchRepo.find({ where: { plantUnit } });

      if (batches.length === 0) {
        return new CommonResponse(true, 200, 'No inventory configured', []);
      }

      const typeMap = new Map<number, { iceTypeName: string; iceTypeCode: string; availableCount: number; totalSlots: number }>();
      for (const batch of batches) {
        const existing = typeMap.get(batch.iceTypeId);
        if (existing) {
          existing.availableCount += batch.availableCount;
          existing.totalSlots     += batch.totalSlots;
        } else {
          typeMap.set(batch.iceTypeId, {
            iceTypeName:    batch.iceTypeName,
            iceTypeCode:    batch.iceTypeCode,
            availableCount: batch.availableCount,
            totalSlots:     batch.totalSlots,
          });
        }
      }

      const result = [...typeMap.entries()].map(([iceTypeId, data]) => ({
        iceTypeId,
        ...data,
        inStock: data.availableCount > 0,
      }));

      return new CommonResponse(true, 200, 'Plant availability fetched', result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, 500, msg, null);
    }
  }

  // ── Release expired reservations (called by SSE poll / cron) ─────────────

  async releaseExpiredReservations(): Promise<number> {
    const expired = await this.slotRepo
      .createQueryBuilder('slot')
      .where('slot.status = :status', { status: 'reserved' })
      .andWhere('slot.reservedUntil < :now', { now: new Date() })
      .getMany();

    if (!expired.length) return 0;

    for (const slot of expired) {
      slot.status        = 'available';
      slot.reservedFor   = null;
      slot.reservedUntil = null;
    }
    await this.slotRepo.save(expired);

    const batchIds = [...new Set(expired.map((s) => s.batchId))];
    for (const batchId of batchIds) {
      const batch = await this.batchRepo.findOne({ where: { id: batchId } });
      if (batch) await this.recalcBatchCounts(batch, this.slotRepo, this.batchRepo);
    }
    return expired.length;
  }

  // ── Customer-order integration ────────────────────────────────────────────

  /**
   * Available slot count per iceTypeId for a plant. Internal helper for the
   * customer order flow — no access check (customers may order from any plant).
   * Returns an empty map when the plant has no inventory configured.
   */
  async getAvailableCountByType(plantUnit: string): Promise<Map<number, number>> {
    const batches = await this.batchRepo.find({ where: { plantUnit } });
    const map = new Map<number, number>();
    for (const b of batches) {
      map.set(b.iceTypeId, (map.get(b.iceTypeId) ?? 0) + b.availableCount);
    }
    return map;
  }

  /**
   * FIFO-reserves slots for a customer order (same picking order as staff
   * sale deduction). Only enforces stock for ice types that have at least one
   * batch in the plant — plants without inventory tracking stay unaffected.
   * Throws Error('Not enough stock …') on shortfall.
   */
  async reserveSlotsForOrder(
    plantUnit: string,
    items: { iceTypeId: number; quantity: number }[],
    saleId: number,
    customerName: string,
    reservedUntil: Date,
  ): Promise<number> {
    const batches = await this.batchRepo.find({ where: { plantUnit } });
    if (batches.length === 0) return 0; // no inventory configured — allow order through

    let reservedTotal = 0;

    for (const item of items) {
      const qty = item.quantity;
      if (!qty || qty <= 0) continue;

      const batchIds = batches
        .filter((b) => b.iceTypeId === item.iceTypeId && b.availableCount > 0)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map((b) => b.id);

      const hasAnyBatch = batches.some((b) => b.iceTypeId === item.iceTypeId);
      if (!hasAnyBatch) continue; // ice type not tracked in inventory — skip

      const available = batchIds.length === 0 ? [] : await this.slotRepo
        .createQueryBuilder('slot')
        .where('slot.batchId IN (:...batchIds)', { batchIds })
        .andWhere('slot.status = :status', { status: 'available' })
        .orderBy('slot.batchId', 'ASC')
        .addOrderBy('slot.id', 'ASC')
        .limit(qty)
        .getMany();

      if (available.length < qty) {
        const iceTypeName = batches.find((b) => b.iceTypeId === item.iceTypeId)?.iceTypeName ?? `ID ${item.iceTypeId}`;
        throw new Error(
          `Not enough stock for "${iceTypeName}": requested ${qty}, available ${available.length}.`,
        );
      }

      for (const slot of available) {
        slot.status        = 'reserved';
        slot.saleId        = saleId;
        slot.reservedFor   = `Order #${saleId} — ${customerName}`.slice(0, 100);
        slot.reservedUntil = reservedUntil;
      }
      await this.slotRepo.save(available);
      reservedTotal += available.length;

      const affected = [...new Set(available.map((s) => s.batchId))];
      for (const batchId of affected) {
        const batch = await this.batchRepo.findOne({ where: { id: batchId } });
        if (batch) await this.recalcBatchCounts(batch, this.slotRepo, this.batchRepo);
      }
    }

    return reservedTotal;
  }

  /** Releases all still-reserved slots held for a sale (payment failed / cancelled). */
  async releaseSlotsForSale(saleId: number): Promise<number> {
    const held = await this.slotRepo.find({ where: { saleId, status: 'reserved' } });
    if (held.length === 0) return 0;

    for (const slot of held) {
      slot.status        = 'available';
      slot.saleId        = null as unknown as number;
      slot.reservedFor   = null;
      slot.reservedUntil = null;
    }
    await this.slotRepo.save(held);

    const batchIds = [...new Set(held.map((s) => s.batchId))];
    for (const batchId of batchIds) {
      const batch = await this.batchRepo.findOne({ where: { id: batchId } });
      if (batch) await this.recalcBatchCounts(batch, this.slotRepo, this.batchRepo);
    }
    return held.length;
  }

  /** Extends the hold on a sale's reserved slots (e.g. after payment succeeds). */
  async extendReservationForSale(saleId: number, until: Date): Promise<number> {
    const result = await this.slotRepo.update(
      { saleId, status: 'reserved' },
      { reservedUntil: until },
    );
    return result.affected ?? 0;
  }

  /**
   * Shop availability for customers: per plant per ice type — available count
   * plus the expected next-availability time (earliest in-production readyAt,
   * else earliest future estimatedNextBatchAt).
   */
  async getShopAvailability(): Promise<
    { plantUnit: string; iceTypeId: number; availableCount: number; expectedAt: string | null }[]
  > {
    const batches = await this.batchRepo.find();
    const now = Date.now();

    const byKey = new Map<string, { plantUnit: string; iceTypeId: number; availableCount: number; expectedAt: string | null }>();

    for (const b of batches) {
      const key = `${b.plantUnit}::${b.iceTypeId}`;
      let entry = byKey.get(key);
      if (!entry) {
        entry = { plantUnit: b.plantUnit, iceTypeId: b.iceTypeId, availableCount: 0, expectedAt: null };
        byKey.set(key, entry);
      }
      entry.availableCount += b.availableCount;

      // Candidate "expected availability" times from batches not yet sellable
      const candidates: Date[] = [];
      if (b.status === 'in_production' && b.readyAt) candidates.push(new Date(b.readyAt));
      if (b.estimatedNextBatchAt) candidates.push(new Date(b.estimatedNextBatchAt));

      for (const c of candidates) {
        if (c.getTime() <= now) continue;
        if (!entry.expectedAt || c < new Date(entry.expectedAt)) {
          entry.expectedAt = c.toISOString();
        }
      }
    }

    return [...byKey.values()];
  }

  // ── Fulfill a customer order (operator hands over selected slots) ─────────

  async fulfillOrder(
    dto: { saleId: number; slotIds: number[] },
    userId: string,
    username: string,
    isAdmin: boolean,
  ): Promise<CommonResponse> {
    const sale = await this.salesRepo.findOne({ where: { id: dto.saleId } });
    if (!sale) return new CommonResponse(false, 404, `Order ${dto.saleId} not found`, null);
    if (!sale.customerId) {
      return new CommonResponse(false, 400, 'Only customer orders can be fulfilled here', null);
    }
    if (sale.fulfillmentStatus !== 'PENDING') {
      return new CommonResponse(false, 409, `Order is already ${sale.fulfillmentStatus.toLowerCase()}`, null);
    }

    const denied = await this.checkPlantAccess(sale.unit, userId, isAdmin);
    if (denied) return denied;

    await this.txManager.startTransaction();
    try {
      const slotTx  = this.txManager.getRepository(this.slotRepo);
      const batchTx = this.txManager.getRepository(this.batchRepo);
      const saleTx  = this.txManager.getRepository(this.salesRepo);

      const slots = await slotTx.find({ where: { id: In(dto.slotIds) } });
      if (slots.length !== dto.slotIds.length) {
        throw new BadRequestException('One or more slot IDs not found');
      }

      const wrongPlant = slots.filter((s) => s.plantUnit !== sale.unit);
      if (wrongPlant.length) {
        throw new BadRequestException(`Slots not in plant "${sale.unit}": ${wrongPlant.map((s) => s.slotLabel).join(', ')}`);
      }

      const unusable = slots.filter(
        (s) => !(s.status === 'available' || (s.status === 'reserved' && s.saleId === sale.id)),
      );
      if (unusable.length) {
        throw new BadRequestException(
          `Slots not available: ${unusable.map((s) => `${s.slotLabel} (${s.status})`).join(', ')}`,
        );
      }

      // Strict match: selected counts per ice type must equal the ordered
      // quantities — but only for types tracked in this plant's inventory.
      const batchIds = [...new Set(slots.map((s) => s.batchId))];
      const slotBatches = batchIds.length === 0 ? [] : await batchTx.find({ where: { id: In(batchIds) } });
      const batchTypeMap = new Map(slotBatches.map((b) => [b.id, b]));

      const selectedByType = new Map<number, number>();
      for (const slot of slots) {
        const iceTypeId = batchTypeMap.get(slot.batchId)?.iceTypeId;
        if (iceTypeId === undefined) throw new BadRequestException(`Batch ${slot.batchId} not found for slot ${slot.slotLabel}`);
        selectedByType.set(iceTypeId, (selectedByType.get(iceTypeId) ?? 0) + 1);
      }

      const plantBatches = await batchTx.find({ where: { plantUnit: sale.unit } });
      const trackedTypes = new Set(plantBatches.map((b) => b.iceTypeId));

      const mismatches: string[] = [];
      for (const item of sale.items) {
        if (item.quantity <= 0 || !trackedTypes.has(item.iceTypeId)) continue;
        const got = selectedByType.get(item.iceTypeId) ?? 0;
        if (got !== item.quantity) {
          mismatches.push(`${item.iceTypeName}: need ${item.quantity}, selected ${got}`);
        }
        selectedByType.delete(item.iceTypeId);
      }
      for (const [iceTypeId, got] of selectedByType) {
        const name = batchTypeMap.get(slots.find((s) => batchTypeMap.get(s.batchId)?.iceTypeId === iceTypeId)?.batchId ?? -1)?.iceTypeName ?? `type ${iceTypeId}`;
        mismatches.push(`${name}: not in this order, selected ${got}`);
      }
      if (mismatches.length) {
        throw new BadRequestException(`Selection must match the order exactly — ${mismatches.join('; ')}`);
      }

      // Sell the selected slots
      const now = new Date();
      for (const slot of slots) {
        slot.status        = 'sold';
        slot.saleId        = sale.id;
        slot.soldBy        = username;
        slot.soldAt        = now;
        slot.reservedFor   = null;
        slot.reservedUntil = null;
      }
      await slotTx.save(slots);

      // Release any other slots still held for this order (operator picked different ones)
      const selectedIds = new Set(dto.slotIds);
      const leftovers = (await slotTx.find({ where: { saleId: sale.id, status: 'reserved' } }))
        .filter((s) => !selectedIds.has(s.id));
      for (const slot of leftovers) {
        slot.status        = 'available';
        slot.saleId        = null as unknown as number;
        slot.reservedFor   = null;
        slot.reservedUntil = null;
      }
      if (leftovers.length) await slotTx.save(leftovers);

      // Recalc all affected batches
      const affected = [...new Set([...slots, ...leftovers].map((s) => s.batchId))];
      for (const batchId of affected) {
        const batch = await batchTx.findOne({ where: { id: batchId } });
        if (batch) await this.recalcBatchCounts(batch, slotTx, batchTx);
      }

      sale.fulfillmentStatus = 'FULFILLED';
      sale.fulfilledBy       = username;
      sale.fulfilledAt       = now;
      await saleTx.save(sale);

      await this.txManager.commitTransaction();

      await this.notificationService.notifyUsers(
        [sale.customerId],
        'ORDER_FULFILLED',
        `Order #${sale.id} is ready`,
        `Your ice order has been prepared and handed over by ${username} at ${sale.unit}.`,
        { saleId: sale.id, plantUnit: sale.unit },
      );

      return new CommonResponse(true, 200, `Order #${sale.id} fulfilled — ${slots.length} slot(s) handed over`, {
        sale,
        slots,
      });
    } catch (err) {
      await this.txManager.rollbackTransaction();
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return new CommonResponse(false, err instanceof BadRequestException ? 400 : 500, msg, null);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async recalcBatchCounts(
    batch: IceBatch,
    slotRepo: any,
    batchRepo: any,
  ): Promise<void> {
    const [available, sold, reserved, damaged] = await Promise.all([
      slotRepo.count({ where: { batchId: batch.id, status: 'available' } }),
      slotRepo.count({ where: { batchId: batch.id, status: 'sold' } }),
      slotRepo.count({ where: { batchId: batch.id, status: 'reserved' } }),
      slotRepo.count({ where: { batchId: batch.id, status: 'damaged' } }),
    ]);

    batch.availableCount = available;
    batch.soldCount      = sold;
    batch.reservedCount  = reserved;
    batch.damagedCount   = damaged;

    const total = batch.totalSlots;
    if (sold + damaged >= total) {
      batch.status = 'sold_out';
    } else if (batch.status === 'in_production' && available > 0) {
      // Status stays in_production until explicitly marked ready.
    }

    await batchRepo.save(batch);
  }
}
