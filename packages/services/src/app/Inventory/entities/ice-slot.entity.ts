import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SlotStatus = 'available' | 'sold' | 'reserved' | 'damaged';

/**
 * One ice unit inside a batch, positioned at (row, col) in the grid.
 * Like a cinema seat — can be available, sold, reserved, or damaged.
 */
@Entity('ice_slots')
@Index(['batchId', 'rowNumber', 'colNumber'], { unique: true })
@Index(['plantUnit', 'status'])
export class IceSlot {
  @PrimaryGeneratedColumn()
  id: number;

  /** FK to ice_batches.id — kept as plain column for performance (no relation join needed). */
  @Column({ type: 'int' })
  batchId: number;

  /** Denormalised for fast plant-scoped queries without joining batches. */
  @Column({ type: 'varchar', length: 100 })
  plantUnit: string;

  @Column({ type: 'int' })
  rowNumber: number;

  @Column({ type: 'int' })
  colNumber: number;

  /** Human label derived from row/col — e.g. "A1", "B3", "R2C4". */
  @Column({ type: 'varchar', length: 10 })
  slotLabel: string;

  @Column({ type: 'varchar', length: 20, default: 'available' })
  status: SlotStatus;

  /** Set when status = 'sold'. References sales.id. */
  @Column({ type: 'int', nullable: true })
  saleId: number | null;

  /** Customer name for whom the slot is reserved. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  reservedFor: string | null;

  /** Reservation auto-expires after this time — frontend / cron releases it. */
  @Column({ type: 'timestamp', nullable: true })
  reservedUntil: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  soldBy: string | null;

  @Column({ type: 'timestamp', nullable: true })
  soldAt: Date | null;

  /** Reason/note when slot is marked damaged. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  damageNote: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
