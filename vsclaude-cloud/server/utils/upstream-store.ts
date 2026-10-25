import { database } from "./database.ts"
import { upstreamsFrom, type Upstream } from "./upstreams.ts"

/**
 * The providers as the `upstreams` table has them (`database.ts`), for
 * `upstreams.ts` to forward down.
 *
 * Read at most every `FRESH_MS` per isolate rather than per request: a chat
 * turn is many requests, and the table changes when somebody adds a provider
 * by hand. A row added or switched off takes up to that long to be seen.
 */
const FRESH_MS = 30_000

let held: { at: number; upstreams: Upstream[] } | null = null

export async function currentUpstreams(): Promise<Upstream[]> {
  if (held && Date.now() - held.at < FRESH_MS) return held.upstreams
  const db = await database()
  const { rows = [] } =
    await db.sql`SELECT name, base_url, api_key, auth FROM upstreams WHERE enabled = 1 ORDER BY priority, name`
  const upstreams = upstreamsFrom(rows)
  held = { at: Date.now(), upstreams }
  return upstreams
}
