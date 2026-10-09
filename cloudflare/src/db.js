/* One request = one transaction, like server.py's BEGIN IMMEDIATE.

   D1 has no interactive transactions, so reads run immediately and writes are queued
   and committed together in one atomic batch. Every read also returns cf_meta.seq,
   a counter that each commit advances by exactly one (a trigger rejects any other
   change). A request that sees the counter move, or whose commit finds it moved,
   throws Conflict and the whole request is run again from the start. The result is
   the same serial order the Python server's write lock produces. */

export class Conflict extends Error {}

const SEQ = 'SELECT seq FROM cf_meta WHERE id=1';

export class Tx {
  constructor(db) {
    this.db = db;
    this.seq = null;
    this.writes = [];
    this.committed = false;
  }

  statement(sql, params = []) {
    return this.db.prepare(sql).bind(...params.map(value => (value === undefined ? null : value)));
  }

  /* Several reads in one round trip: [[sql, params], ...] -> [rows, ...] */
  async reads(queries) {
    const results = await this.db.batch([this.db.prepare(SEQ), ...queries.map(([sql, params]) => this.statement(sql, params))]);
    const seq = results[0].results[0]?.seq ?? 0;
    if (!this.committed) {
      if (this.seq === null) this.seq = seq;
      else if (seq !== this.seq) throw new Conflict();
    }
    return results.slice(1).map(result => result.results);
  }

  async all(sql, ...params) {
    return (await this.reads([[sql, params]]))[0];
  }

  async first(sql, ...params) {
    return (await this.all(sql, ...params))[0] ?? null;
  }

  /* Queue a write; it runs at commit, in order, inside the same atomic batch. */
  run(sql, ...params) {
    this.writes.push(this.statement(sql, params));
  }

  async commit() {
    if (!this.writes.length) {
      this.committed = true;
      return;
    }
    if (this.seq === null) await this.reads([]);
    const guard = this.db.prepare('UPDATE cf_meta SET seq=? WHERE id=1').bind(this.seq + 1);
    try {
      await this.db.batch([guard, ...this.writes]);
    } catch (error) {
      if (String(error?.message ?? error).includes('cf-conflict')) throw new Conflict();
      throw error;
    }
    this.writes = [];
    this.seq += 1;
    this.committed = true;
  }
}
