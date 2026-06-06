import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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
    const user = await this.usersService.findById(userId);
    if (!user || !user.refreshToken)
      throw new UnauthorizedException();

    const valid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!valid) throw new UnauthorizedException();

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
    });

    const hashedRefresh = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(userId, hashedRefresh);

    return { accessToken, refreshToken };
  }
}
