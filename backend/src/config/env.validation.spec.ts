import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const ok = { JWT_SECRET: 'a'.repeat(40), JWT_REFRESH_SECRET: 'b'.repeat(40) };

  it("iki secret da tanımlı ve farklıysa config'i aynen döner", () => {
    expect(validateEnv(ok)).toBe(ok);
  });

  it.each(['JWT_SECRET', 'JWT_REFRESH_SECRET'])(
    '%s eksikse ya da boşsa açılışı durdurur',
    (key) => {
      expect(() => validateEnv({ ...ok, [key]: undefined })).toThrow(
        `${key} tanımlı değil`,
      );
      expect(() => validateEnv({ ...ok, [key]: '   ' })).toThrow(
        `${key} tanımlı değil`,
      );
    },
  );

  it('iki secret aynıysa açılışı durdurur', () => {
    expect(() =>
      validateEnv({ JWT_SECRET: 'ayni', JWT_REFRESH_SECRET: 'ayni' }),
    ).toThrow('farklı olmalı');
  });
});
