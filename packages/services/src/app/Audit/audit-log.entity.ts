import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Immutable trail of sensitive admin/staff actions. */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'varchar', length: 100 })
  username: string;

  /** e.g. USER_CREATED, USER_DELETED, ROLE_CHANGED, SALE_DELETED, CASH_RECORDED, ORDER_CANCELLED */
  @Column({ type: 'varchar', length: 50 })
  action: string;

  /** What was acted on, e.g. 'user', 'sale', 'payment'. */
  @Column({ type: 'varchar', length: 30 })
  entity: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entityId: string | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  detail: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
