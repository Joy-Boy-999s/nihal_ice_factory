import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Represents one factory plant / production unit.
 * Plant names must be unique across the whole table.
 * All ice types and sales reference plants by name (loose coupling — no FK).
 */
@Entity('plants')
@Unique(['plantName'])
export class Plant {
  @PrimaryGeneratedColumn()
  id: number;

  /** Human-readable plant name — e.g. "Unit 1", "Unit 2", "North Plant". */
  @Column({ type: 'varchar', length: 100 })
  plantName: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
