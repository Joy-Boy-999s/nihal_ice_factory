import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { IceBatchRepository } from './repository/ice-batch.repository';
import { IceSlotRepository } from './repository/ice-slot.repository';

const SWEEP_INTERVAL_MS = 15_000;

/**
 * Singleton background sweeper. Previously every connected /inventory/stream
 * client triggered its own releaseExpiredReservations() every 10 s (N clients
 * = N× duplicate DB work). One module-level interval does it once for all.
 *
 * Kept separate from InventoryService on purpose: that service is
 * request-scoped (transaction manager), so it cannot host lifecycle hooks.
 */
@Injectable()
export class InventoryMaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventoryMaintenanceService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly batchRepo: IceBatchRepository,
    private readonly slotRepo: IceSlotRepository,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.releaseExpiredReservations().catch((err: unknown) => {
        this.logger.warn(`Reservation sweep failed: ${err instanceof Error ? err.message : err}`);
      });
    }, SWEEP_INTERVAL_MS);
    this.timer.unref?.(); // never keep the process alive just for the sweep
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Returns reserved slots whose hold expired back to available. */
  async releaseExpiredReservations(): Promise<number> {
    const expired = await this.slotRepo
      .createQueryBuilder('slot')
      .where('slot.status = :status', { status: 'reserved' })
      .andWhere('slot.reservedUntil < :now', { now: new Date() })
      .getMany();

    if (!expired.length) return 0;

    for (const slot of expired) {
      slot.status        = 'available';
      slot.saleId        = null as unknown as number;
      slot.reservedFor   = null;
      slot.reservedUntil = null;
    }
    await this.slotRepo.save(expired);

    const batchIds = [...new Set(expired.map((s) => s.batchId))];
    for (const batchId of batchIds) {
      const batch = await this.batchRepo.findOne({ where: { id: batchId } });
      if (!batch) continue;

      const [available, sold, reserved, damaged] = await Promise.all([
        this.slotRepo.count({ where: { batchId, status: 'available' } }),
        this.slotRepo.count({ where: { batchId, status: 'sold' } }),
        this.slotRepo.count({ where: { batchId, status: 'reserved' } }),
        this.slotRepo.count({ where: { batchId, status: 'damaged' } }),
      ]);
      batch.availableCount = available;
      batch.soldCount      = sold;
      batch.reservedCount  = reserved;
      batch.damagedCount   = damaged;
      if (sold + damaged >= batch.totalSlots) batch.status = 'sold_out';
      await this.batchRepo.save(batch);
    }

    this.logger.log(`Released ${expired.length} expired reservation(s)`);
    return expired.length;
  }
}
