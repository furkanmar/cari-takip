import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService, hashRefreshToken } from './auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

const ENV: Record<string, string> = {
  JWT_SECRET: 'test-access-secret',
  JWT_REFRESH_SECRET: 'test-refresh-secret',
};

/**
 * UsersService yerine bellek içi bir kullanıcı tablosu. JwtService GERÇEK:
 * token'lar gerçekten imzalanıp doğrulanıyor, böylece imza/süre/rotasyon
 * kontrollerini gerçek token'larla deniyoruz.
 */
function setup() {
  const users = new Map<string, User>();
  const usersService = {
    findByEmail: jest.fn((email: string) =>
      Promise.resolve(
        [...users.values()].find((u) => u.email === email) ?? null,
      ),
    ),
    findById: jest.fn((id: string) => Promise.resolve(users.get(id) ?? null)),
    create: jest.fn((data: Partial<User>) => {
      const user = {
        id: `user-${users.size + 1}`,
        refreshToken: null,
        ...data,
      } as User;
      users.set(user.id, user);
      return Promise.resolve(user);
    }),
    updateRefreshToken: jest.fn((id: string, token: string | null) => {
      const u = users.get(id);
      if (u) u.refreshToken = token;
      return Promise.resolve();
    }),
  };
  const config = { get: (key: string) => ENV[key] } as unknown as ConfigService;
  const jwt = new JwtService();
  const service = new AuthService(
    usersService as unknown as UsersService,
    jwt,
    config,
  );
  return { service, users, usersService, jwt };
}

async function seedUser(
  ctx: ReturnType<typeof setup>,
  password = 'dogru-sifre',
) {
  const user = {
    id: '3f1c2b9a-1111-4222-8333-444455556666',
    email: 'furkan@example.com',
    fullName: 'Furkan',
    password: await bcrypt.hash(password, 4),
    refreshToken: null,
  } as User;
  ctx.users.set(user.id, user);
  return user;
}

describe('AuthService', () => {
  describe('register', () => {
    it('kayıtlı e-postayla ikinci kaydı reddeder ve kullanıcı oluşturmaz', async () => {
      const ctx = setup();
      await seedUser(ctx);
      await expect(
        ctx.service.register({
          email: 'furkan@example.com',
          password: 'x12345',
          fullName: 'X',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(ctx.usersService.create).not.toHaveBeenCalled();
    });

    it('şifreyi düz metin değil bcrypt hash olarak saklar ve token döner', async () => {
      const ctx = setup();
      const tokens = await ctx.service.register({
        email: 'yeni@example.com',
        password: 'gizli-sifre',
        fullName: 'Yeni',
      });
      const saved = [...ctx.users.values()][0];
      expect(saved.password).not.toBe('gizli-sifre');
      await expect(bcrypt.compare('gizli-sifre', saved.password)).resolves.toBe(
        true,
      );
      expect(tokens.accessToken).toEqual(expect.any(String));
      expect(saved.refreshToken).toBe(hashRefreshToken(tokens.refreshToken));
    });
  });

  describe('login', () => {
    it('bilinmeyen e-postada 401 döner', async () => {
      const ctx = setup();
      await expect(
        ctx.service.login({ email: 'yok@example.com', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('yanlış şifrede 401 döner ve refresh token yazmaz', async () => {
      const ctx = setup();
      await seedUser(ctx);
      await expect(
        ctx.service.login({ email: 'furkan@example.com', password: 'yanlis' }),
      ).rejects.toThrow('Geçersiz e-posta veya şifre');
      expect(ctx.usersService.updateRefreshToken).not.toHaveBeenCalled();
    });

    it('bilinmeyen e-posta ve yanlış şifre aynı mesajı verir (kullanıcı var mı sızdırmaz)', async () => {
      const ctx = setup();
      await seedUser(ctx);
      const a = await ctx.service
        .login({ email: 'yok@example.com', password: 'x' })
        .catch((e: Error) => e.message);
      const b = await ctx.service
        .login({ email: 'furkan@example.com', password: 'x' })
        .catch((e: Error) => e.message);
      expect(a).toBe(b);
    });

    it('doğru şifrede doğru secret ile imzalı access + refresh token üretir', async () => {
      const ctx = setup();
      const user = await seedUser(ctx);
      const { accessToken, refreshToken } = await ctx.service.login({
        email: 'furkan@example.com',
        password: 'dogru-sifre',
      });

      const access = ctx.jwt.verify<{ sub: string; email: string }>(
        accessToken,
        { secret: ENV.JWT_SECRET },
      );
      expect(access).toMatchObject({ sub: user.id, email: user.email });
      ctx.jwt.verify(refreshToken, { secret: ENV.JWT_REFRESH_SECRET });

      // İki token birbirinin yerine geçemez.
      expect(() => {
        ctx.jwt.verify(refreshToken, { secret: ENV.JWT_SECRET });
      }).toThrow();
      expect(() => {
        ctx.jwt.verify(accessToken, { secret: ENV.JWT_REFRESH_SECRET });
      }).toThrow();

      // DB'ye token'ın kendisi değil hash'i yazılır.
      expect(user.refreshToken).toBe(hashRefreshToken(refreshToken));
      expect(user.refreshToken).not.toContain(refreshToken);
    });
  });

  describe('refresh', () => {
    async function loggedIn() {
      const ctx = setup();
      const user = await seedUser(ctx);
      const tokens = await ctx.service.login({
        email: user.email,
        password: 'dogru-sifre',
      });
      return { ...ctx, user, tokens };
    }

    it('geçerli refresh token ile yeni token çifti verir', async () => {
      const { service, user, tokens } = await loggedIn();
      const next = await service.refresh(user.id, tokens.refreshToken);
      expect(next.refreshToken).not.toBe(tokens.refreshToken);
      expect(user.refreshToken).toBe(hashRefreshToken(next.refreshToken));
    });

    it('rotasyon: kullanılmış (eski) refresh token ikinci kez kabul edilmez', async () => {
      const { service, user, tokens } = await loggedIn();
      const next = await service.refresh(user.id, tokens.refreshToken);
      await expect(
        service.refresh(user.id, tokens.refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      // Yenisi hâlâ çalışır.
      await expect(
        service.refresh(user.id, next.refreshToken),
      ).resolves.toBeDefined();
    });

    it('REGRESYON: yalnızca userId bilinerek üretilen sahte token reddedilir (bcrypt 72 byte açığı)', async () => {
      const { service, user, tokens } = await loggedIn();
      // Eski kodda bcrypt sadece ilk 72 byte'a baktığı için bu token kabul ediliyordu.
      const forged = tokens.refreshToken.slice(0, 72) + 'saldirgan-uydurdu';
      await expect(service.refresh(user.id, forged)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('başka secret ile imzalanmış token reddedilir (ör. access token refresh yerine)', async () => {
      const { service, user, tokens } = await loggedIn();
      await expect(
        service.refresh(user.id, tokens.accessToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('süresi dolmuş refresh token reddedilir', async () => {
      const { service, user, jwt } = await loggedIn();
      const expired = jwt.sign(
        {
          sub: user.id,
          email: user.email,
          exp: Math.floor(Date.now() / 1000) - 60,
        },
        { secret: ENV.JWT_REFRESH_SECRET },
      );
      // DB'de bu token kayıtlıymış gibi yapalım: yine de süre kontrolüne takılmalı.
      user.refreshToken = hashRefreshToken(expired);
      await expect(service.refresh(user.id, expired)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("başka kullanıcının token'ı bu userId ile kullanılamaz", async () => {
      const { service, tokens } = await loggedIn();
      await expect(
        service.refresh('baska-kullanici-id', tokens.refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('bozuk / eksik token 401 döner (500 değil)', async () => {
      const { service, user } = await loggedIn();
      await expect(service.refresh(user.id, 'cop')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(
        service.refresh(user.id, undefined as unknown as string),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it("refresh token hash'ini siler; sonrasında eski refresh token çalışmaz", async () => {
      const ctx = setup();
      const user = await seedUser(ctx);
      const tokens = await ctx.service.login({
        email: user.email,
        password: 'dogru-sifre',
      });

      await ctx.service.logout(user.id);

      expect(ctx.usersService.updateRefreshToken).toHaveBeenLastCalledWith(
        user.id,
        null,
      );
      expect(user.refreshToken).toBeNull();
      await expect(
        ctx.service.refresh(user.id, tokens.refreshToken),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
