import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Bot } from '../../bot/entities/bot.entity';

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.ADMIN,
  })
  role: UserRole;

  // Password reset — a SHA-256 hash of the emailed token is stored, never the
  // raw token, so a DB leak alone can't be used to reset anyone's password.
  @Column({ type: 'text', nullable: true, select: false })
  resetPasswordTokenHash: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  resetPasswordExpiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Bot, (bot) => bot.user)
  bots: Bot[];
}
