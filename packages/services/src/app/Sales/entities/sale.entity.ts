import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Sale {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  date: string;

  @Column()
  time: string;

  @Column()
  unit: string;

  @Column()
  name: string;

  @Column()
  mobile: string;

  @Column()
  shop: string;

  @Column()
  cans: number;

  @Column()
  blocks: number;

  @Column()
  pieces: number;

  @Column()
  totalCans: number;

  @Column({ nullable: true })
  discount?: number;

  @Column()
  totalAmount: number;

  @Column()
  soldBy: string;
}