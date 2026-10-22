/**
 * The pieces of the updater with an opinion: which of two versions is newer,
 * which asset in a release is this machine's, and what a half-finished install
 * says on the button.
 *
 * Worth a test rather than a glance, because both ways of getting it wrong are
 * silent. Say `1.0.9` is newer than `1.0.19` — string comparison, the obvious
 * implementation — and every user is offered a downgrade forever. Say a
 * prerelease is newer than the release it precedes and the same thing happens
 * to whoever is running one.
 */
import {
  assetUrl,
  installerAsset,
  isNewer,
  versionParts,
  WINDOWS_INSTALLER_ARGS,
} from "../src/main/updater"
import { downloadPercent, installLabel } from "../src/renderer/lib/updates"
import { check, finish, section } from "./harness"

section("versionParts")

check("splits a plain version", versionParts("1.0.19").join(".") === "1.0.19")
check("drops a leading v", versionParts("v1.0.19").join(".") === "1.0.19")
check(
  "stops at a prerelease rather than folding it in",
  versionParts("1.0.20-beta.1").join(".") === "1.0.20"
)
check("reads a non-number as zero", versionParts("1.x.3").join(".") === "1.0.3")

section("isNewer")

check("a later patch", isNewer("1.0.20", "1.0.19"))
check(
  "compares numerically, not as text — the bug this exists for",
  isNewer("1.0.19", "1.0.9")
)
check("a later minor", isNewer("1.1.0", "1.0.99"))
check("the same version is not newer", !isNewer("1.0.19", "1.0.19"))
check("a tag's v changes nothing", !isNewer("v1.0.19", "1.0.19"))
check(
  "an older release is never offered — a dev build stays put",
  !isNewer("1.0.19", "1.0.20")
)
check("a release beats its own prerelease", isNewer("1.0.20", "1.0.20-beta.1"))
check(
  "a prerelease of the version you have is not an update",
  !isNewer("1.0.20-beta.1", "1.0.20")
)
check(
  "a shorter version is padded rather than treated as smaller",
  !isNewer("1.0", "1.0.0")
)
check("and the other way round", isNewer("1.0.1", "1.0"))

section("installerAsset")

const release = {
  assets: [
    { name: "Visual Studio Claude-1.0.24-x64.dmg", size: 120 },
    { name: "Visual Studio Claude-1.0.24-arm64.dmg", size: 130 },
    { name: "Visual Studio Claude-1.0.24-arm64.zip", size: 90 },
    { name: "Visual-Studio-Claude-1.0.24-x64.exe", size: 110 },
    { name: "Visual-Studio-Claude-1.0.24-x64.exe.blockmap", size: 1 },
  ],
}

check(
  "picks this arch's dmg",
  installerAsset(release, "darwin", "arm64")?.name ===
    "Visual Studio Claude-1.0.24-arm64.dmg"
)
check(
  "and the other one",
  installerAsset(release, "darwin", "x64")?.name ===
    "Visual Studio Claude-1.0.24-x64.dmg"
)
check(
  "Windows gets the .exe, not a .dmg of the same arch",
  installerAsset(release, "win32", "x64")?.name ===
    "Visual-Studio-Claude-1.0.24-x64.exe"
)
check(
  "a blockmap beside the .exe is not the installer",
  installerAsset(
    {
      assets: [
        { name: "Visual-Studio-Claude-1.0.24-x64.exe.blockmap", size: 1 },
      ],
    },
    "win32",
    "x64"
  ) === null
)
check(
  "Linux has no installer to run",
  installerAsset(release, "linux", "x64") === null
)
check(
  "a .zip of the right arch is not a .dmg",
  installerAsset(
    { assets: [{ name: "Visual Studio Claude-1.0.24-arm64.zip", size: 90 }] },
    "darwin",
    "arm64"
  ) === null
)
check(
  "an arch with no build is null, not the first asset going",
  installerAsset(release, "darwin", "riscv") === null
)
check(
  "a release with no assets",
  installerAsset({ assets: [] }, "darwin", "arm64") === null
)
check(
  "a missing size reads as unknown rather than throwing",
  installerAsset(
    { assets: [{ name: "a-arm64.dmg", size: 0 }] },
    "darwin",
    "arm64"
  )?.size === 0
)

section("assetUrl")

check(
  "a file lives under its version",
  assetUrl("https://dl.example", "1.0.24", "Vey-Studio-1.0.24-arm64.dmg") ===
    "https://dl.example/v1.0.24/Vey-Studio-1.0.24-arm64.dmg"
)
check(
  "a name with spaces is encoded, not sent raw",
  assetUrl(
    "https://dl.example",
    "1.0.24",
    "Visual Studio Claude-1.0.24-arm64.dmg"
  ) === "https://dl.example/v1.0.24/Visual%20Studio%20Claude-1.0.24-arm64.dmg"
)

section("WINDOWS_INSTALLER_ARGS")

check(
  "silent, since the window that asked is gone",
  WINDOWS_INSTALLER_ARGS.includes("/S")
)
check(
  "closes every running copy without a prompt",
  WINDOWS_INSTALLER_ARGS.includes("--updated")
)
check(
  "and reopens the app, which a silent install otherwise does not",
  WINDOWS_INSTALLER_ARGS.includes("--force-run")
)

section("downloadPercent")

check("nothing installing", downloadPercent(null) === null)
check(
  "bytes against a total",
  downloadPercent({
    stage: "downloading",
    version: "1",
    received: 50,
    total: 200,
  }) === 25
)
check(
  "an unknown total is indeterminate, not 0% — a bar stuck at zero for a minute",
  downloadPercent({
    stage: "downloading",
    version: "1",
    received: 50,
    total: 0,
  }) === null
)
check(
  "clamped: a content-length that undercounts must not print 101%",
  downloadPercent({
    stage: "downloading",
    version: "1",
    received: 210,
    total: 200,
  }) === 100
)
check(
  "the install stage has no percentage to give",
  downloadPercent({ stage: "installing", version: "1" }) === null
)

section("installLabel")

check("idle", installLabel(false, null) === "Update and reopen")
check(
  "started, before the first byte",
  installLabel(true, null) === "Downloading…"
)
check(
  "downloading",
  installLabel(true, {
    stage: "downloading",
    version: "1",
    received: 1,
    total: 3,
  }) === "Downloading 33%"
)
check(
  "handed over to the script",
  installLabel(true, { stage: "installing", version: "1" }) === "Installing…"
)

finish()
