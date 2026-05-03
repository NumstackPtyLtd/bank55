import BetterSqlite3 from 'better-sqlite3'

export type Database = BetterSqlite3.Database

export function createDb(path: string): Database {
  const db = new BetterSqlite3(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}
