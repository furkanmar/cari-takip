import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/** Kayıt açma/kapama kontrolü controller'da (REGISTER_ENABLED). */
describe('AuthController.register', () => {
  const dto = { email: 'a@b.com', password: '123456', fullName: 'Ab' };

  function make(registerEnabled: string | undefined) {
    const authService = {
      register: jest
        .fn()
        .mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
    };
    const config = {
      get: (k: string) =>
        k === 'REGISTER_ENABLED' ? registerEnabled : undefined,
    };
    const controller = new AuthController(
      authService as unknown as AuthService,
      config as unknown as ConfigService,
    );
    return { controller, authService };
  }

  it.each([undefined, '', 'false', 'TRUE', '1'])(
    'REGISTER_ENABLED=%p iken 403 döner ve servisi çağırmaz',
    (value) => {
      const { controller, authService } = make(value);
      expect(() => controller.register(dto)).toThrow(ForbiddenException);
      expect(authService.register).not.toHaveBeenCalled();
    },
  );

  it('REGISTER_ENABLED=true iken kaydı servise iletir', async () => {
    const { controller, authService } = make('true');
    await expect(controller.register(dto)).resolves.toEqual({
      accessToken: 'a',
      refreshToken: 'r',
    });
    expect(authService.register).toHaveBeenCalledWith(dto);
  });
});
