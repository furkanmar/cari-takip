import { IsEmail, IsString, MinLength } from 'class-validator';
import { Trim, TrimLowercase } from '../../common/transforms';

export class RegisterDto {
  @TrimLowercase()
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email: string;

  @IsString()
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalı' })
  password: string;

  @Trim()
  @IsString()
  @MinLength(2, { message: 'Ad soyad en az 2 karakter olmalı' })
  fullName: string;
}
