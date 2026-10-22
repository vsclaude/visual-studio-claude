#!/usr/bin/env node
// Writes a release's manifest to stdout: what `main/updater.ts` reads to see
// whether there is a newer build, and to find the installer for this machine.
//
//   node scripts/release-manifest.mjs 1.0.25 installers > manifest.json
//
// Run by `release.yml` after the installers are in the bucket, so a manifest
// that names a file never points at one that is not there yet.

import { execFileSync } from "node:child_process"
import { readdirSync, statSync } from "node:fs"
import path from "node:path"

const [version, dir] = process.argv.slice(2)
if (!version || !dir) {
  console.error("usage: release-manifest.mjs <version> <installers-dir>")
  process.exit(1)
}

const INSTALLER = /\.(dmg|exe|AppImage)$/

const assets = readdirSync(dir)
  .filter((name) => INSTALLER.test(name))
  .sort()
  .map((name) => ({ name, size: statSync(path.join(dir, name)).size }))

if (assets.length === 0) {
  console.error(`no installers in ${dir}`)
  process.exit(1)
}

// The "What's new" text: the subjects since the previous tag. Without a
// previous tag, which is the first release, there is nothing to list.
function notesSincePreviousTag() {
  try {
    const previous = execFileSync(
      "git",
      ["describe", "--tags", "--abbrev=0", "HEAD^"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim()
    return execFileSync("git", ["log", `${previous}..HEAD`, "--format=- %s"], {
      encoding: "utf8",
    }).trim()
  } catch {
    return ""
  }
}

process.stdout.write(
  JSON.stringify({ version, notes: notesSincePreviousTag(), assets }, null, 2) +
    "\n"
)
