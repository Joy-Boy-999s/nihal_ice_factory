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

  @Column({ nullable: true })
  resetPasswordOtp: string;

  @Column({ type: 'timestamp', nullable: true })
  resetPasswordExpires: Date;
}
