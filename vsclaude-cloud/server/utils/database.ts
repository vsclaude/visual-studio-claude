import { useDatabase } from "nitro/database"

/**
 * The D1 database the server keeps what people have paid for in — `default`
 * in `nitro.config.ts`, bound as `DB`. The tables are made the first time a
 * request asks for the database in an isolate; `IF NOT EXISTS` is what lets
 * every isolate run the same statements.
 *
 * Two tables hold the money, described where they are read (`accounts.ts`):
 * `users`, one row per buyer with the balance on it, and `transactions`, one
 * row per purchase from either provider. `sign_ins` is the third and is not
 * money: a sign-in's answer, kept for minutes before it has a user to belong
 * to (`signin.ts`). No JSON inside a cell — a payment is a statement about the
 * rows it changes rather than a whole record read, edited and written back.
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, credits INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS transactions (provider TEXT NOT NULL CHECK (provider IN ('paddle', 'sepay')), id TEXT NOT NULL, uid TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'refunded')), item TEXT, amount INTEGER, credits INTEGER, paid_by INTEGER, short_amount INTEGER NOT NULL DEFAULT 0, short_by INTEGER, created_at TEXT NOT NULL, PRIMARY KEY (provider, id))`,
  `CREATE INDEX IF NOT EXISTS transactions_uid ON transactions (uid)`,
  `CREATE TABLE IF NOT EXISTS sign_ins (nonce TEXT PRIMARY KEY, id_token TEXT, error TEXT, expires_at INTEGER NOT NULL)`,
]

/**
 * The first D1 layout's tables, which kept records as JSON. Nothing creates
 * these any more, so dropping them is a no-op after the first time; what they
 * held was deliberately not carried over. Its `transactions` was a uid per
 * Paddle transaction and has the name the new one needs, so it goes too when
 * it lacks the new one's `provider`.
 */
const RETIRED = [
  "accounts",
  "transfer_orders",
  "sepay_transfers",
  "sign_in_answers",
]

type Database = ReturnType<typeof useDatabase>

/** The D1 binding underneath, as much of it as `atomically` uses: db0 has no
 * transactions on D1, and `batch` is D1's own. */
type D1 = {
  prepare(sql: string): { bind(...values: unknown[]): unknown }
  batch(statements: unknown[]): Promise<unknown>
}

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
  for (const table of RETIRED) await db.exec(`DROP TABLE IF EXISTS ${table}`)
  try {
    await db.exec(`SELECT provider FROM transactions LIMIT 0`)
  } catch {
    await db.exec(`DROP TABLE IF EXISTS transactions`)
  }
  for (const statement of SCHEMA) await db.exec(statement)
}

export type Statement = { sql: string; params: unknown[] }

/** A statement for `atomically`, written as a tagged template like `db.sql`. */
export function statement(
  strings: TemplateStringsArray,
  ...params: unknown[]
): Statement {
  return { sql: strings.join("?"), params }
}

/**
 * Runs the statements in order as one transaction — all of them or none.
 * A later statement can depend on what an earlier one did, which is how a
 * payment marks itself applied and adds its credits without a second delivery
 * adding them again.
 */
export async function atomically(...statements: Statement[]): Promise<void> {
  const d1 = (await (await database()).getInstance()) as D1
  await d1.batch(
    statements.map(({ sql, params }) => d1.prepare(sql).bind(...params))
  )
}
