import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type BatchStatus = 'in_production' | 'ready' | 'sold_out';

/**
 * One production batch of ice at a plant.
 * Rows × cols produces IceSlot records — like rows/seats in a cinema hall.
 */
@Entity('ice_batches')
export class IceBatch {
  @PrimaryGeneratedColumn()
  id: number;

  /** Denormalised plant name reference (matches Plant.plantName). */
  @Column({ type: 'varchar', length: 100 })
  plantUnit: string;

  /** Master ice type snapshot — kept stable even if master is edited later. */
  @Column()
  iceTypeId: number;

  @Column({ type: 'varchar', length: 50 })
  iceTypeName: string;

  @Column({ type: 'varchar', length: 50 })
  iceTypeCode: string;

  /** Human label: "Batch #3", "Morning Batch", etc. */
  @Column({ type: 'varchar', length: 100 })
  batchLabel: string;

  /** Grid dimensions — rows × cols = total ice slots. */
  @Column({ type: 'int' })
  rows: number;

  @Column({ type: 'int' })
  cols: number;

  @Column({ type: 'int' })
  totalSlots: number;

  @Column({ type: 'int', default: 0 })
  availableCount: number;

  @Column({ type: 'int', default: 0 })
  soldCount: number;

  @Column({ type: 'int', default: 0 })
  reservedCount: number;

  @Column({ type: 'int', default: 0 })
  damagedCount: number;

  @Column({ type: 'varchar', length: 20, default: 'in_production' })
  status: BatchStatus;

  /** When ice was put into production (mould fill time). */
  @Column({ type: 'timestamp', nullable: true })
  productionStartedAt: Date | null;

  /** When this batch became / is expected to become ready. */
  @Column({ type: 'timestamp', nullable: true })
  readyAt: Date | null;

  /** Ice shelf-life deadline — alert UI when approaching. */
  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  /** Estimated timestamp when the NEXT batch will be ready — shown as countdown. */
  @Column({ type: 'timestamp', nullable: true })
  estimatedNextBatchAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 100 })
  createdBy: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
