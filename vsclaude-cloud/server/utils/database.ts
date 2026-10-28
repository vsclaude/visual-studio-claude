import { useDatabase } from "nitro/database"

/**
 * The D1 database the server keeps what people have paid for in — `default`
 * in `nitro.config.ts`, bound as `DB`. The tables are made the first time a
 * request asks for the database in an isolate; `IF NOT EXISTS` is what lets
 * every isolate run the same statements.
 *
 * Three tables hold the money and what it bought, described where they are
 * read (`accounts.ts`): `transactions`, one row per purchase; `licenses`, one
 * Vey Pro key per paid order, with how many devices it is for; and
 * `activations`, the devices each key is on. Two more hold what was given
 * away: `campaigns`, a code anybody may redeem for a licence that ends, and
 * `redemptions`, the device each redemption was for. `app_events` is the studio's
 * anonymous usage counts, one row per event (`app-usage.ts`).
 *
 * **There is no sign-in any more** (README § Sign-in, removed): `users` —
 * everybody who signed in with Google, and the key the Google era signed for
 * them — is left as it stands and nothing reads it; `sign_ins` is dropped,
 * since it only ever held answers minutes old. No JSON inside a
 * cell — a payment is a statement about the rows it changes rather than a
 * whole record read, edited and written back.
 *
 * The deleted credits leave three things nothing reads and nothing drops:
 * `users.credits` and `users.used` on a table made before, the `paddle` rows
 * of `transactions`, and the `upstreams` table of providers requests were
 * forwarded to (README § Credits, removed). A database made now has none of
 * the columns or the table.
 */
const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS transactions (provider TEXT NOT NULL CHECK (provider IN ('paddle', 'sepay')), id TEXT NOT NULL, uid TEXT NOT NULL, status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'refunded')), item TEXT, amount INTEGER, currency TEXT, credits INTEGER, paid_by INTEGER, short_amount INTEGER NOT NULL DEFAULT 0, short_by INTEGER, created_at TEXT NOT NULL, paid_at TEXT, PRIMARY KEY (provider, id))`,
  `CREATE INDEX IF NOT EXISTS transactions_uid ON transactions (uid)`,
  `CREATE TABLE IF NOT EXISTS licenses (key TEXT PRIMARY KEY, email TEXT, seats INTEGER NOT NULL, order_code TEXT UNIQUE, issued_at TEXT NOT NULL, revoked_at TEXT, expires_at TEXT, campaign TEXT)`,
  `CREATE TABLE IF NOT EXISTS activations (license TEXT NOT NULL, device TEXT NOT NULL, activated_at TEXT NOT NULL, PRIMARY KEY (license, device))`,
  `CREATE INDEX IF NOT EXISTS activations_device ON activations (device)`,
  `CREATE TABLE IF NOT EXISTS campaigns (code TEXT PRIMARY KEY, months INTEGER NOT NULL, seats INTEGER NOT NULL DEFAULT 1, max_redemptions INTEGER, ends_at TEXT, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS redemptions (campaign TEXT NOT NULL, device TEXT NOT NULL, license TEXT NOT NULL, redeemed_at TEXT NOT NULL, PRIMARY KEY (campaign, device))`,
  `CREATE TABLE IF NOT EXISTS app_events (install_id TEXT NOT NULL, event TEXT NOT NULL CHECK (event IN ('app_opened', 'heartbeat')), at TEXT NOT NULL, active_seconds INTEGER, version TEXT, os TEXT, arch TEXT, country TEXT)`,
  `CREATE INDEX IF NOT EXISTS app_events_at ON app_events (at)`,
  `CREATE INDEX IF NOT EXISTS app_events_install ON app_events (install_id, at)`,
]

/** Columns added since a table was first made — added to one made before,
 * which keeps its rows; each is its definition, name first. `transactions` gained the
 * currency a Paddle charge was in, and when a purchase was paid — a transfer
 * can land hours after its order was opened, and a day's takings are counted
 * by the day the money came (a row paid before it has none); and the buyer's
 * email and the device an order activates, when sign-in went. `licenses`
 * gained when a given-away one ends, and its campaign. `users` is no
 * longer made at all: a database made now has none. */
const ADDED_COLUMNS: Record<string, string[]> = {
  transactions: ["currency TEXT", "paid_at TEXT", "email TEXT", "device TEXT"],
  licenses: ["expires_at TEXT", "campaign TEXT"],
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
  // A Google sign-in's answer, held for minutes until the studio collected
  // it. Sign-in is gone; an answer minutes old is nobody's loss.
  "sign_ins",
]

type Database = ReturnType<typeof useDatabase>

/** The D1 binding underneath, as much of it as `atomically` uses: db0 has no
 * transactions on D1, and `batch` is D1's own. */
type D1 = {
  prepare(sql: string): { bind(...values: unknown[]): unknown }
  batch(statements: unknown[]): Promise<{ meta?: { changes?: number } }[]>
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
 * payment marks itself applied without a second delivery applying it again. Answers how many rows each statement changed, which is
 * how the caller tells that delivery from the second.
 */
export async function atomically(
  ...statements: Statement[]
): Promise<number[]> {
  const d1 = (await (await database()).getInstance()) as D1
  const results = await d1.batch(
    statements.map(({ sql, params }) => d1.prepare(sql).bind(...params))
  )
  return results.map((result) => Number(result?.meta?.changes ?? 0))
}
