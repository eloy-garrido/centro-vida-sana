/**
 * Centro Vida Sana Austral — Adaptador universal para Cloudflare D1 y SQLite Local
 * Permite ejecutar las mismas consultas parametrizadas en Node 22 (node:sqlite)
 * y en el runtime de Cloudflare Workers (env.DB).
 */

export interface DatabaseAdapter {
  first<T = Record<string, any>>(sql: string, ...params: any[]): Promise<T | null>;
  all<T = Record<string, any>>(sql: string, ...params: any[]): Promise<T[]>;
  run(sql: string, ...params: any[]): Promise<{ changes: number }>;
  exec(sql: string): Promise<void>;
  batch(statements: Array<{ sql: string; params?: any[] }>): Promise<void>;
}

/**
 * Adaptador para Cloudflare D1 (env.DB)
 */
export function createD1Adapter(d1: any): DatabaseAdapter {
  return {
    async first<T>(sql: string, ...params: any[]): Promise<T | null> {
      const stmt = d1.prepare(sql).bind(...params);
      const res = await stmt.first();
      return (res as T) ?? null;
    },
    async all<T>(sql: string, ...params: any[]): Promise<T[]> {
      const stmt = d1.prepare(sql).bind(...params);
      const res = await stmt.all();
      return (res.results as T[]) ?? [];
    },
    async run(sql: string, ...params: any[]): Promise<{ changes: number }> {
      const stmt = d1.prepare(sql).bind(...params);
      const res = await stmt.run();
      return { changes: res.meta?.changes ?? 0 };
    },
    async exec(sql: string): Promise<void> {
      await d1.exec(sql);
    },
    async batch(statements: Array<{ sql: string; params?: any[] }>): Promise<void> {
      const prepared = statements.map(s => d1.prepare(s.sql).bind(...(s.params ?? [])));
      await d1.batch(prepared);
    }
  };
}

/**
 * Adaptador para node:sqlite DatabaseSync (Pruebas locales y unitarias)
 */
export function createSqliteAdapter(sqliteDb: any): DatabaseAdapter {
  return {
    async first<T>(sql: string, ...params: any[]): Promise<T | null> {
      const stmt = sqliteDb.prepare(sql);
      const res = stmt.get(...params);
      return (res as T) ?? null;
    },
    async all<T>(sql: string, ...params: any[]): Promise<T[]> {
      const stmt = sqliteDb.prepare(sql);
      const res = stmt.all(...params);
      return (res as T[]) ?? [];
    },
    async run(sql: string, ...params: any[]): Promise<{ changes: number }> {
      const stmt = sqliteDb.prepare(sql);
      const res = stmt.run(...params);
      return { changes: Number(res.changes ?? 0) };
    },
    async exec(sql: string): Promise<void> {
      sqliteDb.exec(sql);
    },
    async batch(statements: Array<{ sql: string; params?: any[] }>): Promise<void> {
      sqliteDb.exec('BEGIN IMMEDIATE;');
      try {
        for (const s of statements) {
          const stmt = sqliteDb.prepare(s.sql);
          stmt.run(...(s.params ?? []));
        }
        sqliteDb.exec('COMMIT;');
      } catch (err) {
        sqliteDb.exec('ROLLBACK;');
        throw err;
      }
    }
  };
}
