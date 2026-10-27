import { useDatabase } from "nitro/database"

/**
 * The D1 database the server keeps what people have paid for in — `default`
 * in `nitro.config.ts`, bound as `DB`. The tables are made the first time a
 * request asks for the database in an isolate; `IF NOT EXISTS` is what lets
 * every isolate run the same statements.
 *
 * Two tables hold the users and the money, described where they are read
 * (`accounts.ts`): `users`, one row per person who signed in, with who Google
 * says they are and their balance, and `transactions`, one row per purchase
 * from either provider. `sign_ins` is the third: a sign-in's answer, kept for
 * minutes until the studio collects it (`signin.ts`). `upstreams` is the
 * providers requests are forwarded to, one row each — its base URL, its key
 * (in plain text, so a provider can be added with one statement; whoever can
 * read this database can read the keys), how the key is sent, `priority`
 * (lowest tried first), `enabled` (`upstream-store.ts`, `upstreams.ts`), and
 * `credit_usd`, the usage the key was bought with — a note for whoever keeps
 * the keys; nothing is sold against it. `app_events` is the studio's
 * anonymous usage counts, one row per event (`app-usage.ts`). No JSON inside a cell —
 * a payment is a statement about the rows it changes rather than a whole
 * record read, edited and written back.
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, email TEXT, name TEXT, picture TEXT, signed_in_at TEXT, credits INTEGER NOT NULL DEFAULT 0, used INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS transactions (provider TEXT NOT NULL CHECK (provider IN ('paddle', 'sepay')), id TEXT NOT NULL, uid TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'refunded')), item TEXT, amount INTEGER, currency TEXT, credits INTEGER, paid_by INTEGER, short_amount INTEGER NOT NULL DEFAULT 0, short_by INTEGER, created_at TEXT NOT NULL, PRIMARY KEY (provider, id))`,
  `CREATE INDEX IF NOT EXISTS transactions_uid ON transactions (uid)`,
  `CREATE TABLE IF NOT EXISTS sign_ins (nonce TEXT PRIMARY KEY, token TEXT, error TEXT, expires_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS app_events (install_id TEXT NOT NULL, event TEXT NOT NULL CHECK (event IN ('app_opened', 'heartbeat')), at TEXT NOT NULL, active_seconds INTEGER, version TEXT, os TEXT, arch TEXT, country TEXT)`,
  `CREATE INDEX IF NOT EXISTS app_events_at ON app_events (at)`,
  `CREATE INDEX IF NOT EXISTS app_events_install ON app_events (install_id, at)`,
  `CREATE TABLE IF NOT EXISTS upstreams (name TEXT PRIMARY KEY, base_url TEXT NOT NULL, api_key TEXT NOT NULL, auth TEXT NOT NULL DEFAULT 'x-api-key' CHECK (auth IN ('x-api-key', 'bearer')), priority INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1, credit_usd REAL NOT NULL DEFAULT 0, note TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
]

/** Columns added since a table was first made — added to one made before,
 * which keeps its rows; each is its definition, name first. `users` gained who
 * somebody is when sign-in moved here from Firebase; `transactions` gained the
 * currency a Paddle charge was in; `upstreams` gained what a key was bought
 * with when the stock moved onto it. */
const ADDED_COLUMNS: Record<string, string[]> = {
  users: ["email TEXT", "name TEXT", "picture TEXT", "signed_in_at TEXT"],
  transactions: ["currency TEXT"],
  upstreams: ["credit_usd REAL NOT NULL DEFAULT 0"],
}

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
  // The stock as a count of packs, then as one balance topped up by hand,
  // before it became the sum of what the `upstreams` keys were bought with.
  // Nothing was sold against either long enough to be worth carrying over.
  "pack_stock",
  "credit_pool",
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
  if (!(await hasColumn(db, "transactions", "provider"))) {
    await db.exec(`DROP TABLE IF EXISTS transactions`)
  }
  // It held a Google ID token for Firebase; what it holds now is this
  // server's, and an answer minutes old is nobody's loss.
  if (!(await hasColumn(db, "sign_ins", "token"))) {
    await db.exec(`DROP TABLE IF EXISTS sign_ins`)
  }
  for (const statement of SCHEMA) await db.exec(statement)
  for (const [table, columns] of Object.entries(ADDED_COLUMNS)) {
    for (const column of columns) {
      const name = column.split(" ")[0]!
      if (!(await hasColumn(db, table, name))) {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${column}`)
      }
    }
  }
}

/**
 * Whether the table has the column — false for no such table too. Only
 * SQLite's own "no such" is a no: a false here is what drops `transactions`,
 * so a D1 that failed to answer at all has to throw rather than read as a
 * table from the old layout and take every purchase with it.
 */
async function hasColumn(
  db: Database,
  table: string,
  column: string
): Promise<boolean> {
  try {
    await db.exec(`SELECT ${column} FROM ${table} LIMIT 0`)
    return true
  } catch (error) {
    if (isNoSuch(error)) return false
    throw error
  }
}

/** D1 says `no such column: …` / `no such table: …`, sometimes on a wrapped
 * error's `cause` rather than its own message. */
export function isNoSuch(error: unknown): boolean {
  for (let at = error, depth = 0; at && depth < 4; depth += 1) {
    const message = at instanceof Error ? at.message : String(at)
    if (/\bno such (column|table)\b/i.test(message)) return true
    at = at instanceof Error ? at.cause : undefined
  }
  return false
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
