/* A D1Database stand-in over node:sqlite, used to run the Worker logic against a local
   SQLite file in tests (the same file the Python test suite inspects). */
import { DatabaseSync } from 'node:sqlite';

const value = v => (v === true ? 1 : v === false ? 0 : v === undefined ? null : v);

class Statement {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    return new Statement(this.db, this.sql, params);
  }
  execute() {
    for (const p of this.params) {
      if (p !== null && typeof p === 'object' && !(p instanceof Uint8Array) && !(p instanceof ArrayBuffer))
        throw new Error('D1_TYPE_ERROR: Type object is not supported');
    }
    const stmt = this.db.handle.prepare(this.sql);
    const params = this.params.map(p => (p instanceof ArrayBuffer ? new Uint8Array(p) : value(p)));
    if (stmt.columns().length) return { results: stmt.all(...params).map(row => ({ ...row })), meta: { changes: 0 } };
    const info = stmt.run(...params);
    return { results: [], meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
  }
  async all() { return this.db.atomic([this])[0]; }
  async first() { return (await this.all()).results[0] ?? null; }
  async run() { return this.db.atomic([this])[0]; }
}

export class LocalD1 {
  constructor(path) {
    this.handle = new DatabaseSync(path);
    this.handle.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=10000;');
  }
  prepare(sql) {
    return new Statement(this, sql);
  }
  atomic(statements) {
    this.handle.exec('BEGIN IMMEDIATE');
    try {
      const results = statements.map(s => s.execute());
      this.handle.exec('COMMIT');
      return results;
    } catch (error) {
      this.handle.exec('ROLLBACK');
      throw error;
    }
  }
  async batch(statements) {
    return this.atomic(statements);
  }
  close() {
    this.handle.close();
  }
}
