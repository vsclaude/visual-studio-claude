import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { MediaKeys, type Sealer } from "../src/main/media/keys"
import { check, finish, section } from "./harness"

/**
 * The media services' keys at rest: sealed, never in the clear, and read back
 * only by the call that spends one.
 */

/** Stands in for `safeStorage`: reversible, and visibly not the plain text. */
function sealer(available = true): Sealer {
  return {
    available: () => available,
    seal: (text) =>
      new TextEncoder().encode(`sealed:${[...text].reverse().join("")}`),
    unseal: (bytes) => {
      const text = new TextDecoder().decode(bytes)
      if (!text.startsWith("sealed:")) throw new Error("not ours")
      return [...text.slice("sealed:".length)].reverse().join("")
    },
  }
}

const dir = await mkdtemp(path.join(tmpdir(), "media-keys-"))
try {
  const file = path.join(dir, "workspace", "media-keys.json")

  section("nothing saved")
  {
    const keys = new MediaKeys(file, sealer())
    const status = await keys.status()
    check("no key", status.keys.elevenlabs === false)
    check("but one could be saved", status.sealable)
    check("no providers", (await keys.providers()).length === 0)
    check("and no key to spend", (await keys.keyOf("elevenlabs")) === null)
  }

  section("a key saved")
  {
    const keys = new MediaKeys(file, sealer())
    const status = await keys.set("elevenlabs", "  sk_secret_123  ")
    check("is reported", status.keys.elevenlabs)
    check(
      "names its provider",
      (await keys.providers()).join() === "elevenlabs"
    )
    check(
      "comes back trimmed",
      (await keys.keyOf("elevenlabs")) === "sk_secret_123"
    )
    const raw = await readFile(file, "utf8")
    check("is not on disk in the clear", !raw.includes("sk_secret_123"), raw)
    check("nor reversed", !raw.includes("321_terces_ks"))
    if (process.platform !== "win32") {
      check(
        "and the file is the owner's alone",
        ((await stat(file)).mode & 0o077) === 0
      )
    }
  }

  section("removed")
  {
    const keys = new MediaKeys(file, sealer())
    const status = await keys.set("elevenlabs", null)
    check("is gone", !status.keys.elevenlabs)
    check("and so is the key", (await keys.keyOf("elevenlabs")) === null)
    await keys.set("elevenlabs", "a")
    await keys.set("elevenlabs", "   ")
    check("a blank one removes too", (await keys.providers()).length === 0)
  }

  section("no keychain")
  {
    const keys = new MediaKeys(file, sealer(false))
    check("says so", !(await keys.status()).sealable)
    const error = await keys
      .set("elevenlabs", "sk")
      .catch((thrown: Error) => thrown)
    check("and refuses rather than writing it plain", error instanceof Error)
    check("nothing was saved", (await keys.providers()).length === 0)
  }

  section("a key the keychain will not open")
  {
    await writeFile(
      file,
      JSON.stringify({ elevenlabs: Buffer.from("garbage").toString("base64") })
    )
    const keys = new MediaKeys(file, sealer())
    check("still counts as set", (await keys.status()).keys.elevenlabs)
    check("but reads as none", (await keys.keyOf("elevenlabs")) === null)
  }

  section("a file that is not JSON")
  {
    await writeFile(file, "{nope")
    const keys = new MediaKeys(file, sealer())
    check("reads as nothing saved", (await keys.providers()).length === 0)
  }
} finally {
  await rm(dir, { recursive: true, force: true })
}

finish()
