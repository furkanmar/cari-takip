import { IsString, IsOptional, IsEmail, MinLength } from 'class-validator';
import { EmptyToUndefined } from '../../common/transforms';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  @EmptyToUndefined()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  @EmptyToUndefined()
  phone?: string;

  @IsOptional()
  @IsEmail()
  @EmptyToUndefined()
  email?: string;

  @IsOptional()
  @IsString()
  @EmptyToUndefined()
  address?: string;
}
