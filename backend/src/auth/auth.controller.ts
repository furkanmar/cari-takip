import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  // Şifre deneme saldırılarına karşı: IP başına dakikada 5 deneme.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  register(@Body() dto: RegisterDto) {
    // Yeni kayıtlar varsayılan olarak kapalı. Açmak için .env'de REGISTER_ENABLED=true yapıp API'yi yeniden başlat.
    if (this.configService.get('REGISTER_ENABLED') !== 'true') {
      throw new ForbiddenException('Yeni kayıtlar şu an kapalı.');
    }
    return this.authService.register(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: { userId: string; refreshToken: string }) {
    return this.authService.refresh(body.userId, body.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  logout(@Request() req) {
    return this.authService.logout(req.user.id);
  }
}
