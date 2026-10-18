import type { H3Event } from "nitro"

/**
 * One line per thing worth knowing, `key=value` after a tag, so a platform's
 * log search can filter on `uid=` or `status=429` without a log library.
 *
 * Never a token or a key, and the uid rather than the email: the uid is enough
 * to find somebody in the Firebase console, and the log is read by more people
 * than the user table is.
 */

export type LogFields = Record<
  string,
  string | number | boolean | null | undefined
>

export function logLine(tag: string, fields: LogFields): void {
  const parts = Object.entries(fields)
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    )
    .map(([key, value]) => `${key}=${quoted(String(value))}`)
  console.log(`${new Date().toISOString()} ${tag} ${parts.join(" ")}`.trimEnd())
}

function quoted(value: string): string {
  return /[\s"=]/.test(value) ? JSON.stringify(value) : value
}

type Logged = { log?: LogFields }

/**
 * Adds to what the request's own line will say — the uid, the model, why it
 * was refused. Printed once, by the `log` plugin, when the response is made.
 */
export function noteRequest(event: H3Event, fields: LogFields): void {
  const context = event.context as Logged
  context.log = { ...context.log, ...fields }
}

/** The plugin's hooks are typed with h3's `HTTPEvent`, which does not declare
 * the `context` every request in fact carries. */
export function notesOf(event: object): LogFields {
  return (event as { context?: Logged }).context?.log ?? {}
}
