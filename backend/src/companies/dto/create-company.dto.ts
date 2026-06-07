import { IsString, IsOptional, IsEmail, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const emptyToUndefined = () => Transform(({ value }) => value === '' ? undefined : value);

export class CreateCompanyDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  @emptyToUndefined()
  taxNumber?: string;

  @IsOptional()
  @IsString()
  @emptyToUndefined()
  phone?: string;

  @IsOptional()
  @IsEmail()
  @emptyToUndefined()
  email?: string;

  @IsOptional()
  @IsString()
  @emptyToUndefined()
  address?: string;
}
