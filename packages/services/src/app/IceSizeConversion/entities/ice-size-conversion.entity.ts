import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Stores a direct pairwise conversion between two ice type names.
 * e.g. "1 Block = 10 Cans" → fromTypeName='Block', toTypeName='Can', factor=10
 * Conversions are global (not per plant).
 */
@Entity('ice_size_conversions')
@Unique(['fromTypeName', 'toTypeName'])
export class IceSizeConversion {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  fromTypeName: string;

  @Column({ type: 'varchar', length: 50 })
  toTypeName: string;

  /** 1 fromTypeName = factor toTypeName */
  @Column({ type: 'decimal', precision: 10, scale: 4 })
  factor: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
