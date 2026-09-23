import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TransactionsService } from './transactions.service';
import { Transaction, TransactionType } from './entities/transaction.entity';
import { BalanceService } from '../balance/balance.service';
import {
  BalanceEntry,
  BalanceEntryType,
} from '../balance/entities/balance-entry.entity';
import { CompaniesService } from '../companies/companies.service';
import { InMemoryRepository } from '../../test/utils/in-memory-repository';

const U = 'user-a';
const OTHER = 'user-b';
const C1 = 'company-1';
const C2 = 'company-2';
const { RECEIVABLE, PAYABLE } = TransactionType;

/**
 * TransactionsService + GERÇEK BalanceService, ikisi de bellek içi repo ile.
 * Böylece "verecek" işlemlerinin bakiye defterine otomatik düşen kaydı da
 * uçtan uca kontrol ediliyor. CompaniesService mock: sahiplik kontrolü ve
 * updateBalances çağrısı gözlemleniyor (SQL kısmı companies spec'inde).
 */
function setup() {
  const txRepo = new InMemoryRepository<Transaction>({
    decimalColumns: ['amount', 'runningBalance'],
    defaults: { runningBalance: 0, linkedBalanceEntryId: null },
  });
  const balRepo = new InMemoryRepository<BalanceEntry>({
    decimalColumns: ['amount', 'runningBalance'],
    defaults: { runningBalance: 0 },
  });
  const companies: Record<
    string,
    { id: string; name: string; userId: string }
  > = {
    [C1]: { id: C1, name: 'ACME', userId: U },
    [C2]: { id: C2, name: 'BETA', userId: U },
  };
  const companiesService = {
    findOne: jest.fn((userId: string, id: string) => {
      const c = companies[id];
      if (!c || c.userId !== userId)
        return Promise.reject(new NotFoundException('Şirket bulunamadı'));
      return Promise.resolve(c);
    }),
    updateBalances: jest.fn().mockResolvedValue(undefined),
  };
  const balanceService = new BalanceService(
    balRepo as unknown as Repository<BalanceEntry>,
  );
  const service = new TransactionsService(
    txRepo as unknown as Repository<Transaction>,
    companiesService as unknown as CompaniesService,
    balanceService,
  );

  const add = (
    date: string,
    type: TransactionType,
    amount: number,
    description = `${type}-${date}`,
    companyId = C1,
  ) => service.create(U, { companyId, date, type, amount, description });
  /** Şirketin işlemlerini tarih sırasıyla [açıklama, yürüyen bakiye] olarak döner. */
  const ledger = async (companyId = C1) =>
    (
      await txRepo.find({
        where: { userId: U, companyId },
        order: { date: 'ASC', createdAt: 'ASC' },
      })
    ).map((t) => [t.description, Number(t.runningBalance)]);
  const balanceEntries = () =>
    balRepo.find({
      where: { userId: U },
      order: { date: 'ASC', createdAt: 'ASC' },
    });

  return {
    service,
    txRepo,
    balRepo,
    companiesService,
    add,
    ledger,
    balanceEntries,
  };
}

describe('TransactionsService — şirket bazında yürüyen bakiye', () => {
  it('alacak (+) ve verecek (−) sırayla toplanır; pozitif = bize borçlu', async () => {
    const { add, ledger } = setup();
    await add('2026-01-01', RECEIVABLE, 1000, 'fatura');
    await add('2026-01-02', PAYABLE, 300, 'odeme');
    await add('2026-01-03', RECEIVABLE, 99.99, 'fatura2');
    expect(await ledger()).toEqual([
      ['fatura', 1000],
      ['odeme', 700],
      ['fatura2', 799.99],
    ]);
  });

  it('geçmiş tarihli işlem eklenince sonraki bakiyeler yeniden hesaplanır', async () => {
    const { add, ledger } = setup();
    await add('2026-02-01', RECEIVABLE, 100, 'sonra');
    await add('2026-01-15', RECEIVABLE, 50, 'once');
    expect(await ledger()).toEqual([
      ['once', 50],
      ['sonra', 150],
    ]);
  });

  it('farklı şirketlerin bakiyeleri birbirinden bağımsızdır', async () => {
    const { add, ledger } = setup();
    await add('2026-01-01', RECEIVABLE, 100, 'a1', C1);
    await add('2026-01-02', RECEIVABLE, 7, 'b1', C2);
    await add('2026-01-03', PAYABLE, 40, 'a2', C1);
    expect(await ledger(C1)).toEqual([
      ['a1', 100],
      ['a2', 60],
    ]);
    expect(await ledger(C2)).toEqual([['b1', 7]]);
  });

  it('tutar güncellemesi sonraki işlemlere yansır', async () => {
    const { add, ledger, service } = setup();
    const a = await add('2026-01-01', RECEIVABLE, 100, 'a');
    await add('2026-01-02', PAYABLE, 30, 'b');
    await service.update(U, a.id, { amount: 1000 });
    expect(await ledger()).toEqual([
      ['a', 1000],
      ['b', 970],
    ]);
  });

  it('işlem ileri tarihe taşınınca sıralama ve bakiyeler düzelir', async () => {
    const { add, ledger, service } = setup();
    const a = await add('2026-01-01', RECEIVABLE, 100, 'a');
    await add('2026-01-02', PAYABLE, 30, 'b');
    await service.update(U, a.id, { date: '2026-01-03' });
    expect(await ledger()).toEqual([
      ['b', -30],
      ['a', 70],
    ]);
  });

  it('silme sonrası sonraki işlemler yeniden hesaplanır', async () => {
    const { add, ledger, service } = setup();
    await add('2026-01-01', RECEIVABLE, 100, 'a');
    const b = await add('2026-01-02', RECEIVABLE, 50, 'b');
    await add('2026-01-03', PAYABLE, 20, 'c');
    await service.remove(U, b.id);
    expect(await ledger()).toEqual([
      ['a', 100],
      ['c', 80],
    ]);
  });

  it('her oluştur/güncelle/sil sonrası şirket toplamları güncellenir', async () => {
    const { add, service, companiesService } = setup();
    const a = await add('2026-01-01', RECEIVABLE, 100);
    await service.update(U, a.id, { amount: 5 });
    await service.remove(U, a.id);
    expect(companiesService.updateBalances).toHaveBeenCalledTimes(3);
    for (const call of companiesService.updateBalances.mock.calls)
      expect(call).toEqual([C1, U]);
  });
});

describe('TransactionsService — verecek işlemi ↔ bakiye defteri bağlantısı', () => {
  it('verecek işlemi bakiye defterine "ŞİRKET - Ödeme" adıyla verilen kaydı açar ve bağlar', async () => {
    const { add, balanceEntries } = setup();
    const tx = await add('2026-01-05', PAYABLE, 250, 'odeme');
    const [entry] = await balanceEntries();
    expect(entry).toMatchObject({
      description: 'ACME - Ödeme',
      type: BalanceEntryType.PAID,
      date: '2026-01-05',
    });
    expect(Number(entry.amount)).toBe(250);
    expect(Number(entry.runningBalance)).toBe(-250);
    expect(tx.linkedBalanceEntryId).toBe(entry.id);
  });

  it('alacak işlemi bakiye defterine kayıt açmaz', async () => {
    const { add, balanceEntries } = setup();
    const tx = await add('2026-01-05', RECEIVABLE, 250);
    expect(await balanceEntries()).toHaveLength(0);
    expect(tx.linkedBalanceEntryId).toBeNull();
  });

  it('verecek tutarı/tarihi değişince bağlı bakiye kaydı da güncellenir', async () => {
    const { add, service, balanceEntries } = setup();
    const tx = await add('2026-01-05', PAYABLE, 250);
    await service.update(U, tx.id, { amount: 400, date: '2026-01-07' });
    const [entry] = await balanceEntries();
    expect(Number(entry.amount)).toBe(400);
    expect(entry.date).toBe('2026-01-07');
  });

  it('verecek → alacak: bağlı bakiye kaydı silinir ve bağ kaldırılır', async () => {
    const { add, service, balanceEntries } = setup();
    const tx = await add('2026-01-05', PAYABLE, 250);
    const updated = await service.update(U, tx.id, { type: RECEIVABLE });
    expect(await balanceEntries()).toHaveLength(0);
    expect(updated.linkedBalanceEntryId).toBeNull();
  });

  it('alacak → verecek: yeni bakiye kaydı açılır ve bağlanır', async () => {
    const { add, service, balanceEntries } = setup();
    const tx = await add('2026-01-05', RECEIVABLE, 80);
    const updated = await service.update(U, tx.id, { type: PAYABLE });
    const entries = await balanceEntries();
    expect(entries).toHaveLength(1);
    expect(Number(entries[0].amount)).toBe(80);
    expect(updated.linkedBalanceEntryId).toBe(entries[0].id);
  });

  it('verecek işlemi silinince bağlı bakiye kaydı da silinir, defter yeniden hesaplanır', async () => {
    const { add, service, balanceEntries } = setup();
    const t1 = await add('2026-01-01', PAYABLE, 100);
    await add('2026-01-02', PAYABLE, 50);
    await service.remove(U, t1.id);
    const entries = await balanceEntries();
    expect(entries).toHaveLength(1);
    expect(Number(entries[0].runningBalance)).toBe(-50);
  });
});

describe('TransactionsService — sahiplik', () => {
  it('başkasının şirketine işlem eklenemez; hiçbir şey kaydedilmez', async () => {
    const { service, txRepo, balRepo } = setup();
    await expect(
      service.create(OTHER, {
        companyId: C1,
        date: '2026-01-01',
        type: PAYABLE,
        amount: 1,
        description: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(txRepo.rows).toHaveLength(0);
    expect(balRepo.rows).toHaveLength(0);
  });

  it('başkasının işlemi okunamaz, güncellenemez, silinemez', async () => {
    const { add, service, txRepo } = setup();
    const tx = await add('2026-01-01', RECEIVABLE, 100);
    await expect(service.findOne(OTHER, tx.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.update(OTHER, tx.id, { amount: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(OTHER, tx.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(Number(txRepo.rows[0].amount)).toBe(100);
  });

  it('REGRESYON: attachInvoice başkasının işlemine fatura bağlayamaz', async () => {
    const { add, service, txRepo } = setup();
    const tx = await add('2026-01-01', RECEIVABLE, 100);
    await expect(
      service.attachInvoice(OTHER, tx.id, 'user-b/x.pdf', 'x.pdf'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(txRepo.rows[0].invoiceUrl).toBeUndefined();
  });
});
