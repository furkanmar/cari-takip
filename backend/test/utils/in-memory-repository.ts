import { randomUUID } from 'crypto';

type Row = Record<string, any>;

const sortable = (v: unknown) =>
  (v instanceof Date ? v.getTime() : v) as string | number;

interface Options {
  /** Postgres `decimal` kolonları: pg bunları string olarak döndürür ("700.00"). */
  decimalColumns?: string[];
  /** DB tarafındaki kolon varsayılanları (ör. runningBalance = 0). */
  defaults?: Row;
}

/**
 * Servis testleri için TypeORM Repository'nin küçük, bellek içi taklidi.
 *
 * Neden basit bir jest.fn() mock değil? Bakiye servisleri "kaydet → yeniden
 * oku → yürüyen bakiyeyi hesapla → toplu kaydet" döngüsü kuruyor. Sonucun doğru
 * olup olmadığını görmek için verinin gerçekten bir yerde durması gerekiyor.
 *
 * Gerçek DB'ye yakın olsun diye:
 *  - okunan her kayıt bir KOPYADIR (save() çağrılmadan yapılan değişiklik kaybolur),
 *  - decimal kolonlar 2 haneye yuvarlanıp string olarak döner (pg davranışı),
 *  - save() yeni kayda id ve artan createdAt verir, verilen nesneye id'yi yazar.
 *
 * createQueryBuilder yalnızca servislerdeki "fromDate'ten önceki son kayıt"
 * sorgusunu destekler; başka bir sorgu gelirse test bilerek patlar.
 */
export class InMemoryRepository<T extends Row> {
  rows: Row[] = [];
  private clock = Date.UTC(2026, 0, 1);

  constructor(private readonly opts: Options = {}) {}

  // ---- yardımcılar ----
  private read(row: Row): T {
    return structuredClone(row) as T;
  }

  private write(entity: Row): Row {
    const row: Row = { ...entity };
    for (const col of this.opts.decimalColumns ?? []) {
      if (row[col] !== undefined && row[col] !== null) {
        row[col] = (Math.round(Number(row[col]) * 100) / 100).toFixed(2);
      }
    }
    return structuredClone(row);
  }

  private matches(row: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([k, v]) => row[k] === v);
  }

  private sort(rows: Row[], order: Record<string, 'ASC' | 'DESC'> = {}) {
    const keys = Object.entries(order);
    return [...rows].sort((a, b) => {
      for (const [k, dir] of keys) {
        const av = sortable(a[k]);
        const bv = sortable(b[k]);
        if (av < bv) return dir === 'ASC' ? -1 : 1;
        if (av > bv) return dir === 'ASC' ? 1 : -1;
      }
      return 0;
    });
  }

  // ---- Repository API'sinin kullanılan kısmı ----
  create(data: Partial<T>): T {
    return { ...(this.opts.defaults ?? {}), ...data } as T;
  }

  save<E extends Row | Row[]>(entity: E): Promise<E> {
    const list = (Array.isArray(entity) ? entity : [entity]) as Row[];
    for (const e of list) {
      if (!e.id) e.id = randomUUID();
      if (!e.createdAt) e.createdAt = new Date((this.clock += 1000));
      const stored = this.write({ ...(this.opts.defaults ?? {}), ...e });
      const i = this.rows.findIndex((r) => r.id === e.id);
      if (i >= 0) this.rows[i] = { ...this.rows[i], ...stored };
      else this.rows.push(stored);
    }
    return Promise.resolve(entity);
  }

  find(opts: { where?: Row; order?: Record<string, 'ASC' | 'DESC'> } = {}) {
    const found = this.rows.filter((r) => this.matches(r, opts.where));
    return Promise.resolve(
      this.sort(found, opts.order).map((r) => this.read(r)),
    );
  }

  findOne(opts: { where: Row }): Promise<T | null> {
    const row = this.rows.find((r) => this.matches(r, opts.where));
    return Promise.resolve(row ? this.read(row) : null);
  }

  update(criteria: string | Row, partial: Row) {
    const where = typeof criteria === 'string' ? { id: criteria } : criteria;
    let affected = 0;
    this.rows = this.rows.map((r) => {
      if (!this.matches(r, where)) return r;
      affected++;
      return { ...r, ...this.write(partial) };
    });
    return Promise.resolve({ affected });
  }

  remove<E extends Row | Row[]>(entity: E): Promise<E> {
    const list = (Array.isArray(entity) ? entity : [entity]) as Row[];
    const ids = list.map((e) => e.id as string);
    this.rows = this.rows.filter((r) => !ids.includes(r.id as string));
    return Promise.resolve(entity);
  }

  createQueryBuilder() {
    let params: Row = {};
    const qb = {
      where: (sql: string, p: Row) => {
        if (!/\.date < :fromDate/.test(sql)) {
          throw new Error(`InMemoryRepository: desteklenmeyen sorgu: ${sql}`);
        }
        params = p;
        return qb;
      },
      orderBy: () => qb,
      addOrderBy: () => qb,
      getOne: () => {
        const { fromDate, ...where } = params;
        const before = this.rows.filter(
          (r) => this.matches(r, where) && r.date < fromDate,
        );
        const last = this.sort(before, { date: 'DESC', createdAt: 'DESC' })[0];
        return Promise.resolve(last ? this.read(last) : null);
      },
    };
    return qb;
  }
}
