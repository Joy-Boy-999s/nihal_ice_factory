import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * Records which users may access which plants.
 * ADMIN users bypass this table entirely — they always see all plants.
 * For non-ADMIN users, only plants with a row here are returned.
 *
 * Loose coupling: no FK constraints so plants / users can be deleted
 * independently without cascading issues.
 */
@Entity('user_plant_access')
@Unique(['userId', 'plantId'])
export class UserPlantAccess {
  @PrimaryGeneratedColumn()
  id: number;

  /** UUID of the user (mirrors users.id — no FK for loose coupling). */
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  /** PK of the plant (mirrors plants.id — no FK for loose coupling). */
  @Column()
  plantId: number;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
