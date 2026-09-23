import { IsEmail, IsString } from 'class-validator';
import { TrimLowercase } from '../../common/transforms';

export class LoginDto {
  @TrimLowercase()
  @IsEmail({}, { message: 'Geçerli bir e-posta adresi girin' })
  email: string;

  @IsString()
  password: string;
}
