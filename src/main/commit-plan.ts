import type { DraftedCommit } from "../shared/api"

/**
 * The most commits one draft is allowed to propose. A change that wants more
 * than this is a change to be split by hand, and a list of six cards to
 * review is more than the commit box can show honestly.
 */
export const MAX_DRAFT_COMMITS = 5

/**
 * What a drafting turn's answer says, read against the files that are staged.
 *
 * The answer is JSON — `{"commits": [{"files": [...], "message": "..."}]}` —
 * because a split is a *mapping* from files to messages, and prose cannot be
 * checked against the index. A model that wrote plain text anyway is not an
 * error: the whole text becomes the message of one commit over everything
 * staged, which is what a draft has always been.
 *
 * Files the answer does not place go into the **last** commit rather than being
 * dropped or failing the draft, so every staged file is in some commit. A file
 * named twice keeps its first place. A path that is not staged is ignored — the
 * answer can only move what is actually in the index. Null when nothing usable
 * came back at all.
 */
export function readPlan(
  answer: string,
  staged: string[]
): DraftedCommit[] | null {
  const text = answer.trim()
  if (!text) return null

  const entries = entriesOf(text)
  if (entries === null) {
    return [{ message: text, files: [...staged] }]
  }

  const known = new Set(staged)
  const placed = new Set<string>()
  const commits: DraftedCommit[] = []

  for (const entry of entries) {
    if (commits.length >= MAX_DRAFT_COMMITS) break
    const message =
      typeof entry?.message === "string" ? entry.message.trim() : ""
    const files: string[] = []
    for (const file of Array.isArray(entry?.files) ? entry.files : []) {
      if (typeof file !== "string") continue
      if (!known.has(file) || placed.has(file) || files.includes(file)) continue
      files.push(file)
    }
    if (!message || files.length === 0) continue
    files.forEach((file) => placed.add(file))
    commits.push({ message, files })
  }

  const left = staged.filter((file) => !placed.has(file))
  if (commits.length === 0)
    return left.length > 0 ? [{ message: text, files: [...staged] }] : null
  commits[commits.length - 1]!.files.push(...left)
  return commits
}

/**
 * The `commits` array out of the answer, with a code fence and any words around
 * the object tolerated — models wrap JSON in both. Null when there is no such
 * object, which is how plain text is told apart from a plan.
 */
function entriesOf(
  text: string
): { message?: unknown; files?: unknown }[] | null {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end <= start) return null
  try {
    const parsed: unknown = JSON.parse(text.slice(start, end + 1))
    const commits = (parsed as { commits?: unknown } | null)?.commits
    return Array.isArray(commits) ? commits : null
  } catch {
    return null
  }
}
