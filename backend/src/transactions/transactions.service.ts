import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { CompaniesService } from '../companies/companies.service';
import { BalanceService } from '../balance/balance.service';
import { BalanceEntryType } from '../balance/entities/balance-entry.entity';
import { UpdateBalanceEntryDto } from '../balance/dto/update-balance-entry.dto';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
    private companiesService: CompaniesService,
    private balanceService: BalanceService,
  ) {}

  async create(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    await this.companiesService.findOne(userId, dto.companyId);

    const transaction = this.transactionsRepository.create({ ...dto, userId });
    await this.transactionsRepository.save(transaction);

    await this.recalculateRunningBalances(userId, dto.companyId, dto.date);
    await this.companiesService.updateBalances(dto.companyId, userId);

    // verilen ise bakiyede otomatik "Bakiye -" kaydı oluştur
    if (dto.type === TransactionType.PAYABLE) {
      const company = await this.companiesService.findOne(
        userId,
        dto.companyId,
      );
      const balanceEntry = await this.balanceService.create(userId, {
        date: dto.date,
        dueDate: dto.dueDate,
        description: `${company.name} - Ödeme`,
        type: BalanceEntryType.PAID,
        amount: dto.amount,
      });
      await this.transactionsRepository.update(transaction.id, {
        linkedBalanceEntryId: balanceEntry.id,
      });
    }

    return this.transactionsRepository.findOne({
      where: { id: transaction.id },
    }) as Promise<Transaction>;
  }

  async findAll(userId: string, companyId: string): Promise<Transaction[]> {
    await this.companiesService.findOne(userId, companyId);
    return this.transactionsRepository.find({
      where: { userId, companyId },
      order: { date: 'DESC', createdAt: 'DESC' },
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
    const oldType = transaction.type;

    Object.assign(transaction, dto);
    await this.transactionsRepository.save(transaction);

    const recalcFrom = dto.date && dto.date < oldDate ? dto.date : oldDate;
    await this.recalculateRunningBalances(
      userId,
      transaction.companyId,
      recalcFrom,
    );
    await this.companiesService.updateBalances(transaction.companyId, userId);

    // Bağlı bakiye kaydını yönet
    const newType = transaction.type;

    if (
      oldType === TransactionType.PAYABLE &&
      newType === TransactionType.RECEIVABLE
    ) {
      // Tür değişti PAYABLE → RECEIVABLE: bakiye kaydını sil
      if (transaction.linkedBalanceEntryId) {
        await this.balanceService.removeById(
          userId,
          transaction.linkedBalanceEntryId,
        );
        await this.transactionsRepository.update(id, {
          linkedBalanceEntryId: null,
        });
      }
    } else if (
      oldType === TransactionType.RECEIVABLE &&
      newType === TransactionType.PAYABLE
    ) {
      // Tür değişti RECEIVABLE → PAYABLE: yeni bakiye kaydı oluştur
      const company = await this.companiesService.findOne(
        userId,
        transaction.companyId,
      );
      const balanceEntry = await this.balanceService.create(userId, {
        date: transaction.date,
        dueDate: transaction.dueDate || undefined,
        description: `${company.name} - Ödeme`,
        type: BalanceEntryType.PAID,
        amount: Number(transaction.amount),
      });
      await this.transactionsRepository.update(id, {
        linkedBalanceEntryId: balanceEntry.id,
      });
    } else if (
      newType === TransactionType.PAYABLE &&
      transaction.linkedBalanceEntryId
    ) {
      // Hâlâ PAYABLE, tutar/tarih değişmiş olabilir → bakiye kaydını güncelle
      const updatePayload: Partial<UpdateBalanceEntryDto> = {};
      if (dto.amount !== undefined) updatePayload.amount = dto.amount;
      if (dto.date !== undefined) updatePayload.date = dto.date;
      if ('dueDate' in dto) updatePayload.dueDate = dto.dueDate;
      if (Object.keys(updatePayload).length > 0) {
        await this.balanceService.updateById(
          userId,
          transaction.linkedBalanceEntryId,
          updatePayload,
        );
      }
    }

    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const transaction = await this.findOne(userId, id);
    const { companyId, date, linkedBalanceEntryId } = transaction;

    await this.transactionsRepository.remove(transaction);
    await this.recalculateRunningBalances(userId, companyId, date);
    await this.companiesService.updateBalances(companyId, userId);

    // Bağlı bakiye kaydını sil
    if (linkedBalanceEntryId) {
      await this.balanceService.removeById(userId, linkedBalanceEntryId);
    }
  }

  async attachInvoice(
    userId: string,
    id: string,
    invoiceUrl: string,
    invoiceFileName: string,
  ): Promise<Transaction> {
    await this.findOne(userId, id); // sahiplik doğrula
    await this.transactionsRepository.update(
      { id, userId },
      { invoiceUrl, invoiceFileName },
    );
    return this.findOne(userId, id);
  }

  private async recalculateRunningBalances(
    userId: string,
    companyId: string,
    fromDate: string,
  ): Promise<void> {
    const previousTransaction = await this.transactionsRepository
      .createQueryBuilder('t')
      .where(
        't.userId = :userId AND t.companyId = :companyId AND t.date < :fromDate',
        {
          userId,
          companyId,
          fromDate,
        },
      )
      .orderBy('t.date', 'DESC')
      .addOrderBy('t.createdAt', 'DESC')
      .getOne();

    let runningBalance = previousTransaction
      ? Number(previousTransaction.runningBalance)
      : 0;

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
