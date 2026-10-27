import { database } from "./database.ts"

/**
 * The studio's anonymous usage counts (`src/main/telemetry.ts` in the studio):
 * `app_opened` at launch and a `heartbeat` of focused seconds every quarter
 * hour, under a random install id. One row of `app_events` each.
 *
 * The endpoint takes no sign-in — the counts are of machines, not people — so
 * anybody can post here, and what is checked is that a row cannot be made to
 * hold anything but the few short fields it is meant to: nothing a caller sends
 * is stored that is not one of them, and each is held to a shape. `at` is this
 * server's clock, not the machine's. The country is Cloudflare's reading of
 * the connection; the address itself is not kept.
 */

export type AppEventName = "app_opened" | "heartbeat"

export type AppUsage = {
  installId: string
  event: AppEventName
  /** Heartbeats only. */
  activeSeconds: number | null
  version: string
  os: string
  arch: string
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}[0-9A-Za-z.+-]{0,24}$/
/** `process.platform` / `process.arch` words. */
const WORD = /^[a-z0-9_]{1,16}$/
/**
 * A heartbeat covers fifteen minutes, so it holds at most 900 seconds; an hour
 * leaves room for a timer the OS held back, and refuses a number that would
 * make one machine look like a hundred.
 */
const MAX_ACTIVE_SECONDS = 3600

/** The body as a row to write, or why not. */
export function appUsageOf(body: unknown): AppUsage | string {
  if (!body || typeof body !== "object") return "not an object"
  const { installId, event, activeSeconds, version, os, arch } = body as Record<
    string,
    unknown
  >
  if (typeof installId !== "string" || !UUID.test(installId)) {
    return "installId is not a UUID"
  }
  if (event !== "app_opened" && event !== "heartbeat") {
    return "no such event"
  }
  if (typeof version !== "string" || !VERSION.test(version)) {
    return "version is not a version"
  }
  if (typeof os !== "string" || !WORD.test(os)) return "os is not a platform"
  if (typeof arch !== "string" || !WORD.test(arch)) return "arch is not one"
  const seconds = event === "heartbeat" ? activeSeconds : null
  if (
    seconds !== null &&
    (typeof seconds !== "number" ||
      !Number.isInteger(seconds) ||
      seconds < 1 ||
      seconds > MAX_ACTIVE_SECONDS)
  ) {
    return "activeSeconds is out of range"
  }
  return {
    installId: installId.toLowerCase(),
    event,
    activeSeconds: seconds as number | null,
    version,
    os,
    arch,
  }
}

/** Cloudflare's two-letter country, or null — `XX` and `T1` (Tor) are its
 * words for not knowing. */
export function countryOf(value: unknown): string | null {
  if (typeof value !== "string" || !/^[A-Z]{2}$/.test(value)) return null
  return value === "XX" || value === "T1" ? null : value
}

export async function recordAppUsage(
  usage: AppUsage,
  country: string | null
): Promise<void> {
  const db = await database()
  await db.sql`INSERT INTO app_events (install_id, event, at, active_seconds, version, os, arch, country) VALUES (${usage.installId}, ${usage.event}, ${new Date().toISOString()}, ${usage.activeSeconds}, ${usage.version}, ${usage.os}, ${usage.arch}, ${country})`
}
