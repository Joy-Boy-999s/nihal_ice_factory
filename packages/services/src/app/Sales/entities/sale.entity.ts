import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/** Snapshot of one line item stored inside a sale record. */
export interface SaleItemSnapshot {
  iceTypeId:   number;
  iceTypeName: string;
  iceTypeCode: string;
  quantity:    number;
  /** Price at time of sale — snapshot so historical records are stable. */
  price:    number;
  subtotal: number;
}

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  date: string;

  @Column()
  time: string;

  /** Factory plant selected for this sale (e.g. "Unit 1"). */
  @Column()
  unit: string;

  @Column()
  name: string;

  @Column()
  mobile: string;

  @Column()
  shop: string;

  /**
   * Snapshot of every line item sold.
   * Stored as JSON so the record is self-contained and immune to master changes.
   */
  @Column({ type: 'json' })
  items: SaleItemSnapshot[];

  @Column({ nullable: true })
  discount?: number;

  /** Sum of all line-item quantities. */
  @Column()
  totalUnits: number;

  @Column('decimal', { precision: 10, scale: 2 })
  totalAmount: number;

  @Column()
  soldBy: string;

  /** Set when the sale is placed by a CUSTOMER account. Links the sale to a user. */
  @Column({ nullable: true })
  customerId?: string;
}
