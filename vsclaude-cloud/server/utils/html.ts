/**
 * `html` — a tagged template that escapes every value put into it, so a page
 * is safe by default rather than by remembering `escape()` at each place a
 * value lands. Not Handlebars: that compiles templates with `new Function`,
 * which Workers refuse, and a template literal keeps `tsc` checking every
 * value a page is given.
 *
 * What is already markup says so: another `html` result, or `raw(...)` for a
 * trusted string (the app's mark, a page's CSS, the arrival card). A value
 * going into a `<script>` goes through `json(...)` — HTML-escaping there would
 * turn a string's quotes into `&quot;` and break the script.
 */

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char)
}

/** Markup that is written into a page as it is. */
export class SafeHtml {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value
  }
}

/** Trust a string as markup. Only for strings this server wrote itself. */
export function raw(markup: string): SafeHtml {
  return new SafeHtml(markup)
}

/**
 * A value as a JavaScript literal, for inside a `<script>`. `<` is written as
 * `<`, so a string holding `</script>` cannot end the script early.
 */
export function json(value: unknown): SafeHtml {
  return new SafeHtml(JSON.stringify(value).replaceAll("<", "\\u003c"))
}

/**
 * What a slot may hold: `null`, `undefined` and `false` write nothing, so
 * `${cond && html`…`}` reads the way it does in JSX; an array is each of its
 * items, so `${rows.map(row)}` needs no `.join("")`.
 */
export type HtmlValue =
  SafeHtml | string | number | boolean | null | undefined | readonly HtmlValue[]

function write(value: HtmlValue): string {
  if (value === null || value === undefined || value === false) return ""
  if (value instanceof SafeHtml) return value.value
  if (Array.isArray(value)) return value.map(write).join("")
  return escapeHtml(String(value))
}

export function html(
  strings: TemplateStringsArray,
  ...values: HtmlValue[]
): SafeHtml {
  let out = strings[0]!
  for (let i = 0; i < values.length; i++) {
    out += write(values[i]) + strings[i + 1]
  }
  return new SafeHtml(out)
}

/** A page as the `Response` a handler answers with. */
export function htmlResponse(page: SafeHtml, status = 200): Response {
  return new Response(page.value, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}
