import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Represents one ice unit-type and its selling price at a specific factory plant.
 *
 * Naming conventions:
 *   • iceTypeName — human-readable label shown to users (e.g. "Cans", "Blocks", "Pieces").
 *   • iceTypeCode — short system code, letters/digits/'.'/'_'/'-' only, no spaces (e.g. "Can").
 *   Regex enforced at DTO level: /^[A-Za-z0-9._-]{2,50}$/
 *
 * Uniqueness: each (iceTypeName + plantUnit) pair must be unique so the same
 * ice type name can appear at different factory plants with independent prices.
 */
@Entity('ice_types')
@Unique(['iceTypeName', 'plantUnit'])
export class IceType {
  @PrimaryGeneratedColumn()
  id: number;

  /** Human-readable name shown in the UI — e.g. "Cans", "Blocks", "Pieces". */
  @Column({ type: 'varchar', length: 50 })
  iceTypeName: string;

  /** Short system code — letters, digits, '.', '_', '-'. No spaces. */
  @Column({ type: 'varchar', length: 50 })
  iceTypeCode: string;

  /** Factory plant this price applies to, e.g. 'Unit 1', 'Unit 2'. */
  @Column({ type: 'varchar', length: 30 })
  plantUnit: string;

  /** Selling price per unit in INR. */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
