import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
export const DATA_DIR = resolve(process.env.DATA_DIR || "data");
mkdirSync(DATA_DIR, { recursive: true });
export const db = new DatabaseSync(resolve(DATA_DIR, "scene-english.sqlite"));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS learners(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE,password TEXT,settings TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tokens(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES learners(id),expires INTEGER NOT NULL,admin INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES learners(id),data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,session_id TEXT NOT NULL,request_key TEXT NOT NULL,data TEXT NOT NULL,result TEXT NOT NULL,UNIQUE(user_id,request_key));
CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,data TEXT NOT NULL,UNIQUE(user_id,id));
CREATE TABLE IF NOT EXISTS recordings(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,session_id TEXT NOT NULL,mime TEXT NOT NULL,data BLOB NOT NULL,created INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS lesson_versions(id TEXT NOT NULL,version INTEGER NOT NULL,data TEXT NOT NULL,status TEXT NOT NULL,published INTEGER DEFAULT 0,PRIMARY KEY(id,version));
CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL);
`);
export function getJSON<T>(
  table: string,
  id: string,
  userId: string,
): T | undefined {
  const row = db
    .prepare(`SELECT data FROM ${table} WHERE id=? AND user_id=?`)
    .get(id, userId) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : undefined;
}
export function listJSON<T>(table: string, userId: string): T[] {
  return (
    db.prepare(`SELECT data FROM ${table} WHERE user_id=?`).all(userId) as {
      data: string;
    }[]
  ).map((r) => JSON.parse(r.data));
}
export function saveJSON(
  table: string,
  id: string,
  userId: string,
  data: unknown,
) {
  db.prepare(
    `INSERT INTO ${table}(id,user_id,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data WHERE user_id=excluded.user_id`,
  ).run(id, userId, JSON.stringify(data));
}
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
