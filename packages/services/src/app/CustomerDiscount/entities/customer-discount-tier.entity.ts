import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('customer_discount_tiers')
export class CustomerDiscountTier {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  customerId!: string;

  @Column('decimal', { precision: 10, scale: 2 })
  minAmount!: number;

  @Column('decimal', { precision: 10, scale: 2 })
  maxAmount!: number;

  @Column('decimal', { precision: 5, scale: 2 })
  discountPercent!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
