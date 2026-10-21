import { describe, expect, test } from "bun:test"

import { html, json, raw } from "../server/utils/html.ts"

/**
 * The page helper's one promise: a value is text unless it says it is markup.
 */

describe("html", () => {
  test("escapes every value", () => {
    const name = `<img src=x onerror="alert('x')">&`
    expect(html`<p title="${name}">${name}</p>`.value).toBe(
      `<p title="&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;">&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;</p>`
    )
  })

  test("writes nested html and raw as they are", () => {
    const inner = html`<b>${"<i>"}</b>`
    expect(html`<p>${inner}${raw("<hr>")}</p>`.value).toBe(
      "<p><b>&lt;i&gt;</b><hr></p>"
    )
  })

  test("null, undefined and false write nothing; 0 is written", () => {
    expect(html`${null}|${undefined}|${false}|${0}|${true}`.value).toBe(
      "|||0|true"
    )
  })

  test("an array is each of its items, escaped the same way", () => {
    // prettier-ignore
    const list = html`<ul>${["a", "<b>"].map((x) => html`<li>${x}</li>`)}</ul>`
    expect(list.value).toBe("<ul><li>a</li><li>&lt;b&gt;</li></ul>")
    expect(html`${["<", raw("<")]}`.value).toBe("&lt;<")
  })
})

describe("json", () => {
  test("is a script literal that cannot close its script", () => {
    const literal = json({ code: `</script><script>alert(1)` }).value
    expect(literal).not.toContain("</script")
    expect(JSON.parse(literal)).toEqual({ code: `</script><script>alert(1)` })
  })

  test("is not HTML-escaped inside html", () => {
    // prettier-ignore
    const script = html`<script>const code = ${json("VSC1")}</script>`
    expect(script.value).toBe(`<script>const code = "VSC1"</script>`)
  })
})
