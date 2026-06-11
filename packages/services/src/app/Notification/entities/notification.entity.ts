import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type NotificationType = 'ORDER_PLACED' | 'ORDER_PAID' | 'ORDER_FULFILLED';

/** Extra payload carried by a notification — used by the UI for deep links. */
export interface NotificationData {
  saleId?: number;
  plantUnit?: string;
  [key: string]: unknown;
}

@Entity('notifications')
@Index(['userId', 'isRead'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  /** Recipient user id (mirrors users.id — no FK for loose coupling). */
  @Column({ type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'varchar', length: 40 })
  type: NotificationType;

  @Column({ type: 'varchar', length: 150 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  body: string;

  @Column({ type: 'json', nullable: true })
  data: NotificationData | null;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;
}
