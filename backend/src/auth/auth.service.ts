import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

interface JwtPayload {
  sub: string;
  email: string;
}

/**
 * Refresh token'lar bcrypt ile DEĞİL, SHA-256 ile saklanır: bcrypt girdinin
 * yalnızca ilk 72 byte'ına bakar ve bir JWT'nin ilk 72 karakteri (header +
 * `{"sub":"<userId>"`) aynı kullanıcı için hep aynıdır. Token zaten yüksek
 * entropili olduğu için yavaş/tuzlu hash'e gerek yok.
 */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Bu e-posta zaten kayıtlı');

    const hashed = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      ...dto,
      password: hashed,
    });

    return this.generateTokens(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Geçersiz e-posta veya şifre');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Geçersiz e-posta veya şifre');

    return this.generateTokens(user.id, user.email);
  }

  async refresh(userId: string, refreshToken: string) {
    // 1) İmza ve süre: token gerçekten bizim refresh secret'ımızla imzalanmış mı?
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException();
    }
    // 2) Token, istekteki kullanıcıya mı ait?
    if (payload.sub !== userId) throw new UnauthorizedException();

    // 3) Rotasyon: yalnızca en son verilen refresh token geçerli.
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshToken) throw new UnauthorizedException();
    if (!safeEqual(hashRefreshToken(refreshToken), user.refreshToken))
      throw new UnauthorizedException();

    return this.generateTokens(user.id, user.email);
  }

  async logout(userId: string) {
    await this.usersService.updateRefreshToken(userId, null);
  }

  private async generateTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
      // Aynı saniyede üretilen iki token'ın birebir aynı olmaması için.
      jwtid: randomUUID(),
    });

    await this.usersService.updateRefreshToken(
      userId,
      hashRefreshToken(refreshToken),
    );

    return { accessToken, refreshToken };
  }
}
