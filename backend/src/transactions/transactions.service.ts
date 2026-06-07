import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { CompaniesService } from '../companies/companies.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private companiesService: CompaniesService,
    private dataSource: DataSource,
  ) {}

  async create(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    // Şirketin bu kullanıcıya ait olduğunu doğrula
    await this.companiesService.findOne(userId, dto.companyId);

    const transaction = this.transactionsRepository.create({
      ...dto,
      userId,
    });

    await this.transactionsRepository.save(transaction);

    // Bu tarihten itibaren tüm running balance'ları yeniden hesapla
    await this.recalculateRunningBalances(userId, dto.companyId, dto.date);

    // Şirket toplam bakiyelerini güncelle
    await this.companiesService.updateBalances(dto.companyId, userId);

    return this.transactionsRepository.findOne({ where: { id: transaction.id } }) as Promise<Transaction>;
  }

  async findAll(
    userId: string,
    companyId: string,
  ): Promise<Transaction[]> {
    await this.companiesService.findOne(userId, companyId);

    return this.transactionsRepository.find({
      where: { userId, companyId },
      order: { date: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(userId: string, id: string): Promise<Transaction> {
    const transaction = await this.transactionsRepository.findOne({
      where: { id, userId },
    });
    if (!transaction) throw new NotFoundException('İşlem bulunamadı');
    return transaction;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const transaction = await this.findOne(userId, id);
    const oldDate = transaction.date;

    Object.assign(transaction, dto);
    await this.transactionsRepository.save(transaction);

    // Eski veya yeni tarihten itibaren yeniden hesapla
    const recalcFrom =
      dto.date && dto.date < oldDate ? dto.date : oldDate;
    await this.recalculateRunningBalances(userId, transaction.companyId, recalcFrom);
    await this.companiesService.updateBalances(transaction.companyId, userId);

    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const transaction = await this.findOne(userId, id);
    const { companyId, date } = transaction;

    await this.transactionsRepository.remove(transaction);

    await this.recalculateRunningBalances(userId, companyId, date);
    await this.companiesService.updateBalances(companyId, userId);
  }

  async attachInvoice(
    id: string,
    invoiceUrl: string,
    invoiceFileName: string,
  ): Promise<Transaction> {
    await this.transactionsRepository.update(id, { invoiceUrl, invoiceFileName });
    return this.transactionsRepository.findOne({ where: { id } }) as Promise<Transaction>;
  }

  // Belirtilen tarihten itibaren tüm işlemlerin running balance'ını yeniden hesaplar
  private async recalculateRunningBalances(
    userId: string,
    companyId: string,
    fromDate: string,
  ): Promise<void> {
    // fromDate'den önceki son balance'ı bul
    const previousTransaction = await this.transactionsRepository
      .createQueryBuilder('t')
      .where('t.userId = :userId AND t.companyId = :companyId AND t.date < :fromDate', {
        userId,
        companyId,
        fromDate,
      })
      .orderBy('t.date', 'DESC')
      .addOrderBy('t.createdAt', 'DESC')
      .getOne();

    let runningBalance = previousTransaction
      ? Number(previousTransaction.runningBalance)
      : 0;

    // fromDate ve sonrasındaki tüm işlemleri tarihe göre sırala
    const transactions = await this.transactionsRepository.find({
      where: { userId, companyId },
      order: { date: 'ASC', createdAt: 'ASC' },
    });

    const toUpdate = transactions.filter((t) => t.date >= fromDate);

    for (const t of toUpdate) {
      if (t.type === TransactionType.RECEIVABLE) {
        runningBalance += Number(t.amount);
      } else {
        runningBalance -= Number(t.amount);
      }
      t.runningBalance = runningBalance;
    }

    if (toUpdate.length > 0) {
      await this.transactionsRepository.save(toUpdate);
    }
  }
}
