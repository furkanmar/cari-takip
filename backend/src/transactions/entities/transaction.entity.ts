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
import { Company } from '../../companies/entities/company.entity';

export enum TransactionType {
  RECEIVABLE = 'receivable', // alacak (bize borçlu)
  PAYABLE = 'payable', // verecek (biz borçluyuz)
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  companyId: string;

  @ManyToOne(() => Company, (company) => company.transactions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column({ type: 'date' })
  date: string; // işlem tarihi (geçmişe eklenebilir)

  @Column({ type: 'date', nullable: true })
  dueDate: string | null; // vade tarihi

  @Column()
  description: string;

  @Column({ type: 'enum', enum: TransactionType })
  type: TransactionType;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  // Bu işlemden sonraki net bakiye
  // pozitif = alacak, negatif = verecek
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  runningBalance: number;

  @Column({ nullable: true })
  invoiceUrl: string; // MinIO'daki dosya yolu

  @Column({ nullable: true })
  invoiceFileName: string;

  // verilen türündeyse otomatik oluşturulan bakiye kaydının ID'si
  @Column({ type: 'varchar', nullable: true, default: null })
  linkedBalanceEntryId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
