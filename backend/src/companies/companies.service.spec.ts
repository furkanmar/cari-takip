import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CompaniesService } from './companies.service';
import { Company } from './entities/company.entity';

/**
 * updateBalances toplamları SQL'de (SUM + CASE) hesaplıyor; o kısmı ancak
 * gerçek Postgres doğrular. Burada doğruladığımız: sorgu kullanıcıyla
 * sınırlanıyor mu, pg'nin döndürdüğü string/NULL değerler doğru sayıya
 * çevriliyor mu ve doğru şirkete yazılıyor mu.
 */
function setup(raw: Record<string, string | null> | undefined) {
  const qb = {
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    setParameters: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue(raw),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    findOne: jest.fn(),
    create: jest.fn((d: Partial<Company>) => d),
    save: jest.fn((d: Partial<Company>) => Promise.resolve(d)),
  };
  const service = new CompaniesService(repo as unknown as Repository<Company>);
  return { service, repo, qb };
}

describe('CompaniesService.updateBalances', () => {
  it("pg'nin string döndürdüğü toplamları sayıya çevirip şirkete yazar", async () => {
    const { service, repo } = setup({
      totalReceivable: '1500.75',
      totalPayable: '300.00',
    });
    await service.updateBalances('c1', 'u1');
    expect(repo.update).toHaveBeenCalledWith('c1', {
      totalReceivable: 1500.75,
      totalPayable: 300,
    });
  });

  it('hiç işlem yoksa (SUM → NULL) toplamları 0 yapar, NaN yazmaz', async () => {
    const { service, repo } = setup({
      totalReceivable: null,
      totalPayable: null,
    });
    await service.updateBalances('c1', 'u1');
    expect(repo.update).toHaveBeenCalledWith('c1', {
      totalReceivable: 0,
      totalPayable: 0,
    });
  });

  it("sorgu şirket id'si VE kullanıcı id'siyle sınırlanır, alacak/verecek türleri doğru bağlanır", async () => {
    const { service, qb } = setup({ totalReceivable: '0', totalPayable: '0' });
    await service.updateBalances('c1', 'u1');
    const [sql, params] = qb.where.mock.calls[0] as [
      string,
      Record<string, string>,
    ];
    expect(sql).toMatch(/company\.id = :companyId/);
    expect(sql).toMatch(/company\.userId = :userId/);
    expect(params).toEqual({ companyId: 'c1', userId: 'u1' });
    expect(qb.setParameters).toHaveBeenCalledWith({
      receivable: 'receivable',
      payable: 'payable',
    });
  });
});

describe('CompaniesService', () => {
  it('şirket adını kırpıp büyük harfe çevirir', async () => {
    const { service, repo } = setup(undefined);
    await service.create('u1', { name: '  acme ltd ' });
    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ACME LTD', userId: 'u1' }),
    );
  });

  it('findOne sorguyu kullanıcıyla sınırlar; başkasının şirketi 404', async () => {
    const { service, repo } = setup(undefined);
    repo.findOne.mockResolvedValue(null);
    await expect(service.findOne('u2', 'c1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.findOne).toHaveBeenCalledWith({
      where: { id: 'c1', userId: 'u2' },
    });
  });
});
