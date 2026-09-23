import { Transform, TransformFnParams } from 'class-transformer';

/**
 * DTO'larda kullanılan ortak dönüşümler. Değer string değilse dokunmadan
 * bırakılır; tip hatasını class-validator yakalar (önceden `value?.trim()`
 * sayı/obje gelince TypeError atıp 500 döndürüyordu, artık 400).
 */
const mapString = (fn: (s: string) => unknown) =>
  Transform(({ value }: TransformFnParams): unknown => {
    const v: unknown = value;
    return typeof v === 'string' ? fn(v) : v;
  });

export const Trim = () => mapString((s) => s.trim());

export const TrimLowercase = () => mapString((s) => s.trim().toLowerCase());

export const EmptyToUndefined = () =>
  mapString((s) => (s === '' ? undefined : s));
