import { INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { THROTTLE_DEFAULT } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { CfThrottlerGuard } from '../src/common/cf-throttler.guard';
import { AuthModule } from '../src/auth/auth.module';
import { UsersModule } from '../src/users/users.module';
import { CompaniesModule } from '../src/companies/companies.module';
import { CompaniesService } from '../src/companies/companies.service';
import { TransactionsModule } from '../src/transactions/transactions.module';
import { BalanceModule } from '../src/balance/balance.module';
import { FilesService } from '../src/files/files.service';
import { User } from '../src/users/entities/user.entity';
import { Company } from '../src/companies/entities/company.entity';
import { Transaction } from '../src/transactions/entities/transaction.entity';
import { BalanceEntry } from '../src/balance/entities/balance-entry.entity';
import { InMemoryRepository } from './utils/in-memory-repository';

/**
 * HTTP katmanı uçtan uca: gerçek controller'lar, guard'lar (JWT + rate limit),
 * ValidationPipe ve servisler. Veritabanı ve MinIO yerine bellek içi taklitler
 * var; bu yüzden CI'da Postgres gerekmeden çalışıyor.
 *
 * AppModule'ü doğrudan kullanamıyoruz çünkü TypeOrmModule.forRootAsync açılışta
 * Postgres'e bağlanmaya çalışıyor; aynı modülleri burada DB'siz birleştiriyoruz.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    ThrottlerModule.forRoot(THROTTLE_DEFAULT),
    AuthModule,
    UsersModule,
    CompaniesModule,
    TransactionsModule,
    BalanceModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: CfThrottlerGuard }],
})
class TestAppModule {}

const PASSWORD = 'cok-gizli-sifre';
let ipCounter = 0;
/** Her senaryoya ayrı "istemci IP'si" — rate limit sayaçları karışmasın. */
const freshIp = () => `10.0.0.${++ipCounter}`;

describe('cari-takip API (e2e)', () => {
  let app: INestApplication<App>;
  let files: { uploadInvoice: jest.Mock; getPresignedUrl: jest.Mock };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-access-secret';
    process.env.JWT_REFRESH_SECRET = 'e2e-refresh-secret';
    delete process.env.REGISTER_ENABLED;

    files = {
      uploadInvoice: jest.fn((_file: unknown, userId: string, id: string) =>
        Promise.resolve({ url: `${userId}/${id}/f.pdf`, fileName: 'f.pdf' }),
      ),
      getPresignedUrl: jest
        .fn()
        .mockResolvedValue('https://minio.local/signed'),
    };
    const decimals = { decimalColumns: ['amount', 'runningBalance'] };

    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(
        new InMemoryRepository<User>({ defaults: { refreshToken: null } }),
      )
      .overrideProvider(getRepositoryToken(Company))
      .useValue(
        new InMemoryRepository<Company>({ defaults: { isArchived: false } }),
      )
      .overrideProvider(getRepositoryToken(Transaction))
      .useValue(
        new InMemoryRepository<Transaction>({
          ...decimals,
          defaults: { runningBalance: 0, linkedBalanceEntryId: null },
        }),
      )
      .overrideProvider(getRepositoryToken(BalanceEntry))
      .useValue(
        new InMemoryRepository<BalanceEntry>({
          ...decimals,
          defaults: { runningBalance: 0 },
        }),
      )
      .overrideProvider(FilesService)
      .useValue(files)
      .compile();

    // updateBalances SUM/CASE ile SQL'de çalışıyor; bellek içi repo bunu yapamaz.
    jest
      .spyOn(moduleRef.get(CompaniesService), 'updateBalances')
      .mockResolvedValue(undefined);

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function registerAndLogin(email: string) {
    process.env.REGISTER_ENABLED = 'true';
    await http()
      .post('/api/auth/register')
      .set('CF-Connecting-IP', freshIp())
      .send({ email, password: PASSWORD, fullName: 'Test Kullanıcı' })
      .expect(201);
    delete process.env.REGISTER_ENABLED;
    const res = await http()
      .post('/api/auth/login')
      .set('CF-Connecting-IP', freshIp())
      .send({ email, password: PASSWORD })
      .expect(200);
    const body = res.body as { accessToken: string; refreshToken: string };
    const me = await http()
      .get('/api/users/me')
      .auth(body.accessToken, { type: 'bearer' })
      .expect(200);
    return { ...body, id: (me.body as { id: string }).id };
  }

  describe('kayıt', () => {
    it('REGISTER_ENABLED yokken 403 döner', async () => {
      await http()
        .post('/api/auth/register')
        .set('CF-Connecting-IP', freshIp())
        .send({ email: 'x@example.com', password: PASSWORD, fullName: 'X Y' })
        .expect(403);
    });

    it("geçersiz e-posta ve DTO'da olmayan alan 400 döner (ValidationPipe devrede)", async () => {
      process.env.REGISTER_ENABLED = 'true';
      const ip = freshIp();
      await http()
        .post('/api/auth/register')
        .set('CF-Connecting-IP', ip)
        .send({ email: 'eposta-degil', password: PASSWORD, fullName: 'X Y' })
        .expect(400);
      await http()
        .post('/api/auth/register')
        .set('CF-Connecting-IP', ip)
        .send({
          email: 'y@example.com',
          password: PASSWORD,
          fullName: 'X Y',
          isAdmin: true,
        })
        .expect(400);
      delete process.env.REGISTER_ENABLED;
    });
  });

  describe('oturum akışı', () => {
    it('token olmadan korumalı uç 401, access token ile 200; profil şifre/refresh hash sızdırmaz', async () => {
      const user = await registerAndLogin('akis@example.com');
      await http().get('/api/companies').expect(401);
      await http()
        .get('/api/companies')
        .auth('bozuk.token.degeri', { type: 'bearer' })
        .expect(401);
      await http()
        .get('/api/companies')
        .auth(user.accessToken, { type: 'bearer' })
        .expect(200);

      const me = await http()
        .get('/api/users/me')
        .auth(user.accessToken, { type: 'bearer' })
        .expect(200);
      expect(me.body).not.toHaveProperty('password');
      expect(me.body).not.toHaveProperty('refreshToken');
    });

    it('refresh token korumalı uçlarda access token yerine geçmez', async () => {
      const user = await registerAndLogin('karisik@example.com');
      await http()
        .get('/api/companies')
        .auth(user.refreshToken, { type: 'bearer' })
        .expect(401);
    });

    it('refresh → yeni çift; eski refresh 401; logout sonrası yeni refresh de 401', async () => {
      const user = await registerAndLogin('rotasyon@example.com');
      const ip = freshIp();

      const r1 = await http()
        .post('/api/auth/refresh')
        .set('CF-Connecting-IP', ip)
        .send({ userId: user.id, refreshToken: user.refreshToken })
        .expect(200);
      const next = r1.body as { accessToken: string; refreshToken: string };

      await http()
        .post('/api/auth/refresh')
        .set('CF-Connecting-IP', ip)
        .send({ userId: user.id, refreshToken: user.refreshToken })
        .expect(401);

      await http()
        .post('/api/auth/logout')
        .auth(next.accessToken, { type: 'bearer' })
        .expect(200);
      await http()
        .post('/api/auth/refresh')
        .set('CF-Connecting-IP', ip)
        .send({ userId: user.id, refreshToken: next.refreshToken })
        .expect(401);
    });

    it('REGRESYON: yalnızca userId ile uydurulan refresh token 401 döner', async () => {
      const user = await registerAndLogin('sahte@example.com');
      const forged = user.refreshToken.slice(0, 72) + 'uydurma';
      await http()
        .post('/api/auth/refresh')
        .set('CF-Connecting-IP', freshIp())
        .send({ userId: user.id, refreshToken: forged })
        .expect(401);
    });
  });

  describe('rate limit (CF-Connecting-IP bazlı)', () => {
    it("aynı IP'den dakikada 5 login denemesinden sonra 429; başka IP etkilenmez", async () => {
      const ip = freshIp();
      for (let i = 0; i < 5; i++) {
        await http()
          .post('/api/auth/login')
          .set('CF-Connecting-IP', ip)
          .send({ email: 'yok@example.com', password: 'yanlis' })
          .expect(401);
      }
      await http()
        .post('/api/auth/login')
        .set('CF-Connecting-IP', ip)
        .send({ email: 'yok@example.com', password: 'yanlis' })
        .expect(429);
      await http()
        .post('/api/auth/login')
        .set('CF-Connecting-IP', freshIp())
        .send({ email: 'yok@example.com', password: 'yanlis' })
        .expect(401);
    });
  });

  describe('kullanıcılar arası yalıtım', () => {
    let a: Awaited<ReturnType<typeof registerAndLogin>>;
    let b: Awaited<ReturnType<typeof registerAndLogin>>;
    let companyId: string;
    let transactionId: string;
    let entryId: string;

    beforeAll(async () => {
      a = await registerAndLogin('a@example.com');
      b = await registerAndLogin('b@example.com');
      const c = await http()
        .post('/api/companies')
        .auth(a.accessToken, { type: 'bearer' })
        .send({ name: 'acme' })
        .expect(201);
      companyId = (c.body as { id: string }).id;
      const t = await http()
        .post('/api/transactions')
        .auth(a.accessToken, { type: 'bearer' })
        .send({
          companyId,
          date: '2026-01-01',
          description: 'fatura',
          type: 'receivable',
          amount: 100,
        })
        .expect(201);
      transactionId = (t.body as { id: string }).id;
      const e = await http()
        .post('/api/balance')
        .auth(a.accessToken, { type: 'bearer' })
        .send({
          date: '2026-01-01',
          description: 'tahsilat',
          type: 'received',
          amount: 100,
        })
        .expect(201);
      entryId = (e.body as { id: string }).id;
      files.uploadInvoice.mockClear();
    });

    it("B, A'nın şirketini/işlemini/bakiye kaydını göremez (404)", async () => {
      await http()
        .get(`/api/companies/${companyId}`)
        .auth(b.accessToken, { type: 'bearer' })
        .expect(404);
      await http()
        .get(`/api/transactions/${transactionId}`)
        .auth(b.accessToken, { type: 'bearer' })
        .expect(404);
      await http()
        .get(`/api/balance/${entryId}`)
        .auth(b.accessToken, { type: 'bearer' })
        .expect(404);
      const list = await http()
        .get('/api/companies')
        .auth(b.accessToken, { type: 'bearer' })
        .expect(200);
      expect(list.body).toEqual([]);
    });

    it("B, A'nın şirketine işlem ekleyemez", async () => {
      await http()
        .post('/api/transactions')
        .auth(b.accessToken, { type: 'bearer' })
        .send({
          companyId,
          date: '2026-01-02',
          description: 'x',
          type: 'payable',
          amount: 1,
        })
        .expect(404);
    });

    it("REGRESYON: B, A'nın işlemine/bakiye kaydına fatura yükleyemez; MinIO'ya dosya gitmez", async () => {
      await http()
        .post(`/api/transactions/${transactionId}/invoice`)
        .auth(b.accessToken, { type: 'bearer' })
        .attach('invoice', Buffer.from('%PDF-1.4'), 'x.pdf')
        .expect(404);
      await http()
        .post(`/api/balance/${entryId}/invoice`)
        .auth(b.accessToken, { type: 'bearer' })
        .attach('invoice', Buffer.from('%PDF-1.4'), 'x.pdf')
        .expect(404);
      expect(files.uploadInvoice).not.toHaveBeenCalled();

      const t = await http()
        .get(`/api/transactions/${transactionId}`)
        .auth(a.accessToken, { type: 'bearer' })
        .expect(200);
      expect((t.body as { invoiceUrl?: string }).invoiceUrl).toBeUndefined();
    });

    it('A kendi işlemine fatura yükleyebilir', async () => {
      const res = await http()
        .post(`/api/transactions/${transactionId}/invoice`)
        .auth(a.accessToken, { type: 'bearer' })
        .attach('invoice', Buffer.from('%PDF-1.4'), 'f.pdf')
        .expect(201);
      expect(res.body).toMatchObject({
        invoiceUrl: `${a.id}/${transactionId}/f.pdf`,
      });
    });
  });
});
