import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.companies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  name: string;

  @Column({ nullable: true })
  taxNumber: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalReceivable: number; // toplam alacak

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPayable: number; // toplam verecek

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Transaction, (transaction) => transaction.company)
  transactions: Transaction[];
}
