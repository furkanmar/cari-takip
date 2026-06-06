import { IsString, IsOptional, IsEmail, MinLength } from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
