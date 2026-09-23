import {
  Injectable,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async updateRefreshToken(userId: string, token: string | null) {
    await this.usersRepository.update(userId, {
      refreshToken: token,
    });
  }

  async getProfile(userId: string) {
    const user = await this.findById(userId);
    if (!user) return null;
    const { password, refreshToken, ...profile } = user;
    return profile;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.findById(userId);
    if (!user) throw new BadRequestException('Kullanıcı bulunamadı');

    // E-posta veya şifre değişiyorsa mevcut şifre zorunlu
    if ((dto.email && dto.email !== user.email) || dto.newPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Bu değişiklik için mevcut şifrenizi girmelisiniz',
        );
      }
      const valid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!valid) throw new BadRequestException('Mevcut şifre hatalı');
    }

    if (dto.fullName) user.fullName = dto.fullName;

    if (dto.email && dto.email !== user.email) {
      const existing = await this.findByEmail(dto.email);
      if (existing) throw new ConflictException('Bu e-posta zaten kullanımda');
      user.email = dto.email;
    }

    if (dto.newPassword) {
      user.password = await bcrypt.hash(dto.newPassword, 12);
    }

    await this.usersRepository.save(user);
    const { password, refreshToken, ...profile } = user;
    return profile;
  }
}
