import { existsSync } from "node:fs"
import {
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { check, finish, section } from "./harness"

/**
 * The default project — the one a chat with no project in mind runs in —
 * against a real data directory: that every workspace has it, that it is made
 * once, and that it cannot be removed.
 */

const root = await mkdtemp(path.join(tmpdir(), "default-project-"))
// Before the store is imported and constructed: it reads the data directory
// once, when it is made.
process.env.VEYSTUDIO_DATA_DIR = root
const { Store, WORKSPACE_DIR, DEFAULT_FOLDER_DIR } =
  await import("../src/main/store")
const dir = path.join(root, WORKSPACE_DIR, DEFAULT_FOLDER_DIR)

try {
  section("an empty workspace")
  {
    const store = new Store()
    const { folders } = await store.getWorkspace()
    const made = folders[0]
    check("has one project", folders.length === 1, folders)
    check("and it is the default", made?.builtIn === true, made)
    check("its directory is made", existsSync(dir))
    check(
      "and recorded resolved",
      made?.path === (await realpath(dir)),
      made?.path
    )
    check(
      "written into the manifest",
      (await readFile(path.join(root, "manifest.json"), "utf8")).includes(
        '"builtIn": true'
      )
    )

    const again = await store.getWorkspace()
    check(
      "made once — a second read finds the same id",
      again.folders.length === 1 && again.folders[0]?.id === made?.id,
      again.folders
    )

    section("removing it")
    let refused = false
    try {
      await store.removeFolder(made!.id)
    } catch {
      refused = true
    }
    check("is refused", refused)
    check(
      "and leaves it in the workspace",
      (await store.getWorkspace()).folders.some((f) => f.id === made?.id)
    )

    section("its directory deleted from under it")
    await rm(dir, { recursive: true, force: true })
    const cwd = await store.resolveFolderDir(made!.id)
    check("is made again when a chat asks where to run", existsSync(cwd))
  }

  section("a workspace that already had that directory as a project")
  {
    await rm(root, { recursive: true, force: true })
    await mkdir(dir, { recursive: true })
    const store = new Store()
    await store.getWorkspace() // made and marked
    const manifestPath = path.join(root, "manifest.json")
    // As an `Add project` of the directory would have left it: unmarked.
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
    delete manifest.workspace.folders[0].builtIn
    await writeFile(manifestPath, JSON.stringify(manifest))

    const { folders } = await store.getWorkspace()
    check(
      "is marked rather than added twice",
      folders.length === 1 && folders[0]?.builtIn === true,
      folders
    )
  }
} finally {
  await rm(root, { recursive: true, force: true })
}

finish()
