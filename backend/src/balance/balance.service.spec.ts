import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BalanceService } from './balance.service';
import {
  BalanceEntry,
  BalanceEntryType,
} from './entities/balance-entry.entity';
import { InMemoryRepository } from '../../test/utils/in-memory-repository';

const U = 'user-a';
const OTHER = 'user-b';
const { RECEIVED, PAID } = BalanceEntryType;

function setup() {
  const repo = new InMemoryRepository<BalanceEntry>({
    decimalColumns: ['amount', 'runningBalance'],
    defaults: { runningBalance: 0 },
  });
  const service = new BalanceService(
    repo as unknown as Repository<BalanceEntry>,
  );
  /** Kullanıcının kayıtlarını tarih sırasıyla [açıklama, yürüyen bakiye] olarak döner. */
  const ledger = async (userId = U) =>
    (
      await repo.find({
        where: { userId },
        order: { date: 'ASC', createdAt: 'ASC' },
      })
    ).map((e) => [e.description, Number(e.runningBalance)]);
  const add = (
    date: string,
    type: BalanceEntryType,
    amount: number,
    description = `${type}-${date}`,
  ) => service.create(U, { date, type, amount, description });
  return { repo, service, ledger, add };
}

describe('BalanceService — yürüyen bakiye', () => {
  it('alınan (+) ve verilen (−) kayıtları sırayla toplar', async () => {
    const { add, ledger } = setup();
    await add('2026-01-01', RECEIVED, 1000, 'a');
    await add('2026-01-02', PAID, 300, 'b');
    await add('2026-01-03', RECEIVED, 50.5, 'c');
    expect(await ledger()).toEqual([
      ['a', 1000],
      ['b', 700],
      ['c', 750.5],
    ]);
  });

  it('geçmiş tarihli kayıt eklenince sonraki bakiyeler yeniden hesaplanır', async () => {
    const { add, ledger } = setup();
    await add('2026-01-10', RECEIVED, 100, 'sonra');
    await add('2026-01-05', PAID, 40, 'once');
    expect(await ledger()).toEqual([
      ['once', -40],
      ['sonra', 60],
    ]);
  });

  it('aynı gündeki kayıtlar oluşturulma sırasına göre işlenir', async () => {
    const { add, ledger } = setup();
    await add('2026-01-01', RECEIVED, 100, 'ilk');
    await add('2026-01-01', PAID, 30, 'ikinci');
    expect(await ledger()).toEqual([
      ['ilk', 100],
      ['ikinci', 70],
    ]);
  });

  it("DB'den string gelen decimal değerleri sayı olarak toplar (string birleştirme yok)", async () => {
    const { add, ledger } = setup();
    await add('2026-01-01', RECEIVED, 0.1, 'a');
    await add('2026-01-02', RECEIVED, 0.2, 'b');
    expect(await ledger()).toEqual([
      ['a', 0.1],
      ['b', 0.3],
    ]);
  });

  it('tutar güncellenince sonraki kayıtlar da düzelir', async () => {
    const { add, ledger, service } = setup();
    const a = await add('2026-01-01', RECEIVED, 100, 'a');
    await add('2026-01-02', PAID, 30, 'b');
    await service.update(U, a.id, { amount: 500 });
    expect(await ledger()).toEqual([
      ['a', 500],
      ['b', 470],
    ]);
  });

  it('kayıt İLERİ bir tarihe taşınınca eski ve yeni konum arası doğru hesaplanır', async () => {
    const { add, ledger, service } = setup();
    const a = await add('2026-01-01', RECEIVED, 100, 'a');
    await add('2026-01-02', PAID, 30, 'b');
    await service.update(U, a.id, { date: '2026-01-03' });
    expect(await ledger()).toEqual([
      ['b', -30],
      ['a', 70],
    ]);
  });

  it('kayıt GERİ bir tarihe taşınınca doğru hesaplanır', async () => {
    const { add, ledger, service } = setup();
    await add('2026-01-01', RECEIVED, 100, 'a');
    const b = await add('2026-01-05', PAID, 30, 'b');
    await service.update(U, b.id, { date: '2025-12-31' });
    expect(await ledger()).toEqual([
      ['b', -30],
      ['a', 70],
    ]);
  });

  it('silme sonrası sonraki kayıtlar yeniden hesaplanır', async () => {
    const { add, ledger, service } = setup();
    await add('2026-01-01', RECEIVED, 100, 'a');
    const b = await add('2026-01-02', PAID, 30, 'b');
    await add('2026-01-03', RECEIVED, 10, 'c');
    await service.remove(U, b.id);
    expect(await ledger()).toEqual([
      ['a', 100],
      ['c', 110],
    ]);
  });

  it('kullanıcıların bakiyeleri birbirine karışmaz', async () => {
    const { add, ledger, service } = setup();
    await add('2026-01-01', RECEIVED, 100, 'a');
    await service.create(OTHER, {
      date: '2026-01-02',
      type: PAID,
      amount: 999,
      description: 'x',
    });
    await add('2026-01-03', RECEIVED, 1, 'c');
    expect(await ledger()).toEqual([
      ['a', 100],
      ['c', 101],
    ]);
    expect(await ledger(OTHER)).toEqual([['x', -999]]);
  });

  it('getSummary: alınan, verilen ve net toplamı döner', async () => {
    const { add, service } = setup();
    await add('2026-01-01', RECEIVED, 1000);
    await add('2026-01-02', PAID, 250.25);
    await add('2026-01-03', RECEIVED, 0.25);
    await service.create(OTHER, {
      date: '2026-01-01',
      type: RECEIVED,
      amount: 5000,
      description: 'x',
    });
    await expect(service.getSummary(U)).resolves.toEqual({
      totalReceived: 1000.25,
      totalPaid: 250.25,
      net: 750,
    });
  });
});

describe('BalanceService — sahiplik', () => {
  it('başka kullanıcının kaydını okuyamaz, güncelleyemez, silemez', async () => {
    const { add, service, repo } = setup();
    const a = await add('2026-01-01', RECEIVED, 100);
    await expect(service.findOne(OTHER, a.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.update(OTHER, a.id, { amount: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.remove(OTHER, a.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.rows).toHaveLength(1);
    expect(Number(repo.rows[0].amount)).toBe(100);
  });

  it('removeById / updateById başka kullanıcının kaydına dokunmaz (sessizce geçer)', async () => {
    const { add, service, repo } = setup();
    const a = await add('2026-01-01', RECEIVED, 100);
    await service.removeById(OTHER, a.id);
    await service.updateById(OTHER, a.id, { amount: 1 });
    expect(repo.rows).toHaveLength(1);
    expect(Number(repo.rows[0].amount)).toBe(100);
  });

  it('REGRESYON: attachInvoice başka kullanıcının kaydına fatura bağlayamaz', async () => {
    const { add, service, repo } = setup();
    const a = await add('2026-01-01', RECEIVED, 100);
    await expect(
      service.attachInvoice(OTHER, a.id, 'user-b/x.pdf', 'x.pdf'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.rows[0].invoiceUrl).toBeUndefined();
  });

  it('attachInvoice kendi kaydına fatura bağlar', async () => {
    const { add, service } = setup();
    const a = await add('2026-01-01', RECEIVED, 100);
    const res = await service.attachInvoice(U, a.id, 'user-a/f.pdf', 'f.pdf');
    expect(res).toMatchObject({
      invoiceUrl: 'user-a/f.pdf',
      invoiceFileName: 'f.pdf',
    });
  });
});
