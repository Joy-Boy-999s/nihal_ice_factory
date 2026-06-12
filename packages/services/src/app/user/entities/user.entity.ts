import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  role:string;

  /**
   * Mobile linked to this account — auto-set from the customer's first
   * authenticated order. Used to recognise WhatsApp senders.
   */
  @Column({ type: 'varchar', length: 15, nullable: true })
  mobile?: string | null;

  @Column({ nullable: true })
  resetPasswordOtp: string;

  @Column({ type: 'timestamp', nullable: true })
  resetPasswordExpires: Date;
}
