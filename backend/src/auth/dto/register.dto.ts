import { IsEmail, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalı' })
  password: string;

  @Transform(({ value }) => value?.trim())
  @IsString()
  @MinLength(2, { message: 'Ad soyad en az 2 karakter olmalı' })
  fullName: string;
}
