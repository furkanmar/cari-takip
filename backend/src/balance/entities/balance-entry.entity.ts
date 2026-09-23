import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum BalanceEntryType {
  RECEIVED = 'received', // alınan (gelen para)
  PAID = 'paid', // verilen (giden para)
}

@Entity('balance_entries')
export class BalanceEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  @Column()
  description: string;

  @Column({ type: 'enum', enum: BalanceEntryType })
  type: BalanceEntryType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  runningBalance: number;

  @Column({ nullable: true })
  invoiceUrl: string;

  @Column({ nullable: true })
  invoiceFileName: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
