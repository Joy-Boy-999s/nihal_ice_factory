import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  saleId: number;

  @Column({ unique: true })
  razorpayOrderId: string;

  @Column({ nullable: true })
  razorpayPaymentId: string;

  @Column({ nullable: true })
  razorpaySignature: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column({ default: 'PENDING' })
  status: PaymentStatus;

  @Column({ nullable: true })
  failureReason: string;

  @Column({ nullable: true })
  razorpayRefundId: string;

  @Column({ nullable: true })
  customerName: string;

  @Column({ nullable: true })
  customerMobile: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
