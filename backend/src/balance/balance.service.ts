import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BalanceEntry, BalanceEntryType } from './entities/balance-entry.entity';
import { CreateBalanceEntryDto } from './dto/create-balance-entry.dto';
import { UpdateBalanceEntryDto } from './dto/update-balance-entry.dto';

@Injectable()
export class BalanceService {
  constructor(
    @InjectRepository(BalanceEntry)
    private balanceRepository: Repository<BalanceEntry>,
  ) {}

  async create(userId: string, dto: CreateBalanceEntryDto): Promise<BalanceEntry> {
    const entry = this.balanceRepository.create({ ...dto, userId });
    await this.balanceRepository.save(entry);
    await this.recalculateRunningBalances(userId, dto.date);
    return this.balanceRepository.findOne({ where: { id: entry.id } }) as Promise<BalanceEntry>;
  }

  async findAll(userId: string): Promise<BalanceEntry[]> {
    return this.balanceRepository.find({
      where: { userId },
      order: { date: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(userId: string, id: string): Promise<BalanceEntry> {
    const entry = await this.balanceRepository.findOne({ where: { id, userId } });
    if (!entry) throw new NotFoundException('Kayıt bulunamadı');
    return entry;
  }

  async update(userId: string, id: string, dto: UpdateBalanceEntryDto): Promise<BalanceEntry> {
    const entry = await this.findOne(userId, id);
    const oldDate = entry.date;
    Object.assign(entry, dto);
    await this.balanceRepository.save(entry);
    const recalcFrom = dto.date && dto.date < oldDate ? dto.date : oldDate;
    await this.recalculateRunningBalances(userId, recalcFrom);
    return this.findOne(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOne(userId, id); // sahiplik doğrula
    await this.removeById(userId, id);
  }

  // TransactionsService'in dahili kullanımı için — userId doğrulaması zaten yapılmış
  async removeById(userId: string, id: string): Promise<void> {
    const entry = await this.balanceRepository.findOne({ where: { id, userId } });
    if (!entry) return; // zaten silinmişse sessizce geç
    const { date } = entry;
    await this.balanceRepository.remove(entry);
    await this.recalculateRunningBalances(userId, date);
  }

  // TransactionsService'in dahili kullanımı için
  async updateById(userId: string, id: string, dto: Partial<UpdateBalanceEntryDto>): Promise<void> {
    const entry = await this.balanceRepository.findOne({ where: { id, userId } });
    if (!entry) return;
    const oldDate = entry.date;
    Object.assign(entry, dto);
    await this.balanceRepository.save(entry);
    const recalcFrom = dto.date && dto.date < oldDate ? dto.date : oldDate;
    await this.recalculateRunningBalances(userId, recalcFrom);
  }

  async attachInvoice(id: string, invoiceUrl: string, invoiceFileName: string): Promise<BalanceEntry> {
    await this.balanceRepository.update(id, { invoiceUrl, invoiceFileName });
    return this.balanceRepository.findOne({ where: { id } }) as Promise<BalanceEntry>;
  }

  async getSummary(userId: string): Promise<{ totalReceived: number; totalPaid: number; net: number }> {
    const entries = await this.findAll(userId);
    const totalReceived = entries
      .filter(e => e.type === BalanceEntryType.RECEIVED)
      .reduce((s, e) => s + Number(e.amount), 0);
    const totalPaid = entries
      .filter(e => e.type === BalanceEntryType.PAID)
      .reduce((s, e) => s + Number(e.amount), 0);
    return { totalReceived, totalPaid, net: totalReceived - totalPaid };
  }

  private async recalculateRunningBalances(userId: string, fromDate: string): Promise<void> {
    const previous = await this.balanceRepository
      .createQueryBuilder('b')
      .where('b.userId = :userId AND b.date < :fromDate', { userId, fromDate })
      .orderBy('b.date', 'DESC')
      .addOrderBy('b.createdAt', 'DESC')
      .getOne();

    let running = previous ? Number(previous.runningBalance) : 0;

    const all = await this.balanceRepository.find({
      where: { userId },
      order: { date: 'ASC', createdAt: 'ASC' },
    });

    const toUpdate = all.filter(e => e.date >= fromDate);

    for (const e of toUpdate) {
      running += e.type === BalanceEntryType.RECEIVED ? Number(e.amount) : -Number(e.amount);
      e.runningBalance = running;
    }

    if (toUpdate.length > 0) {
      await this.balanceRepository.save(toUpdate);
    }
  }
}
