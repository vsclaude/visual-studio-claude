import type { WorkspaceFolder, WorkspaceRecord } from "@shared/api"

export type { WorkspaceFolder, WorkspaceRecord }

/** The workspace and the folders in it. */
export async function getWorkspace(): Promise<WorkspaceRecord> {
  return window.desktop.getWorkspace()
}

export async function addFolder(input: {
  path: string
  name: string
}): Promise<WorkspaceRecord> {
  return window.desktop.addFolder(input)
}

/** An empty directory, added as a folder, for a template's CLI to fill. */
export async function createProject(input: {
  parent: string
  name: string
  template: string
}): Promise<WorkspaceRecord> {
  return window.desktop.createProject(input)
}

/** A project made from a template, moved to the Trash and dropped. */
export async function trashProject(folderId: string): Promise<WorkspaceRecord> {
  return window.desktop.trashProject(folderId)
}

/** A `git worktree` of a project, added as a folder of its own. */
export async function addWorktree(input: {
  folderId: string
  branch: string
  base?: string
}): Promise<WorkspaceRecord> {
  return window.desktop.addWorktree(input)
}

/** The branches `New worktree…` suggests, local and remote. */
export async function worktreeBranches(
  folderId: string
): Promise<{ local: string[]; remote: string[] }> {
  return window.desktop.worktreeBranches(folderId)
}

/** A worktree's checkout deleted with `git worktree remove`, and dropped. */
export async function removeWorktree(
  folderId: string
): Promise<WorkspaceRecord> {
  return window.desktop.removeWorktree(folderId)
}

export async function renameFolder(
  id: string,
  name: string
): Promise<WorkspaceRecord> {
  return window.desktop.renameFolder(id, name)
}

export async function removeFolder(id: string): Promise<WorkspaceRecord> {
  return window.desktop.removeFolder(id)
}

export async function reorderFolders(ids: string[]): Promise<WorkspaceRecord> {
  return window.desktop.reorderFolders(ids)
}

/** Opens the system folder picker. Resolves with null when cancelled. */
export async function pickDirectory(): Promise<string | null> {
  return window.desktop.pickDirectory()
}

/** The branch checked out in a folder, or null when it is not a git
 * repository. */
export async function gitBranch(folderId: string): Promise<string | null> {
  return window.desktop.gitBranch(folderId)
}

export async function getSetting(key: string): Promise<string | null> {
  return window.desktop.getSetting(key)
}

export async function setSetting(key: string, value: string): Promise<void> {
  await window.desktop.setSetting(key, value)
}
