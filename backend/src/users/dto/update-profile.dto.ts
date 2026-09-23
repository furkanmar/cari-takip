import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';
import { TrimLowercase } from '../../common/transforms';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @TrimLowercase()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Şifre en az 6 karakter olmalı' })
  newPassword?: string;
}
