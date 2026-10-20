import { useDatabase } from "nitro/database"

/**
 * The D1 database the server keeps what people have paid for in — `default`
 * in `nitro.config.ts`, bound as `DB`. The tables are made the first time a
 * request asks for the database in an isolate; `IF NOT EXISTS` is what lets
 * every isolate run the same statements.
 *
 * Each table's keys are described where it is read (`accounts.ts`,
 * `signin.ts`). A `data` column holds a whole record as JSON, because nothing
 * queries inside one; a balance is a column, because it is changed by a
 * statement of its own (`chargeCredits`).
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS accounts (uid TEXT PRIMARY KEY, credits INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0, orders TEXT NOT NULL DEFAULT '[]')`,
  `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, uid TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS transfer_orders (code TEXT PRIMARY KEY, data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sepay_transfers (id INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sign_in_answers (nonce TEXT PRIMARY KEY, answer TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
]

type Database = ReturnType<typeof useDatabase>

let ready: Promise<void> | undefined

/** The database, with its tables in place. */
export async function database(): Promise<Database> {
  const db = useDatabase()
  ready ??= createTables(db).catch((error: unknown) => {
    // A failed attempt is retried by the next request, not remembered.
    ready = undefined
    throw error
  })
  await ready
  return db
}

async function createTables(db: Database): Promise<void> {
  for (const statement of SCHEMA) await db.exec(statement)
}
