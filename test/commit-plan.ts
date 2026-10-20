import { execFile } from "node:child_process"
import { chmod, mkdtemp, mkdir, rename, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"

import { readPlan, MAX_DRAFT_COMMITS } from "../src/main/commit-plan"
import { commitSeries, stagedPaths } from "../src/main/git"
import { check, finish, section } from "./harness"

/**
 * The draft's plan of commits, read against what is staged, and the series
 * commit that writes it.
 *
 * `readPlan` is pure and is tested on its own. `commitSeries` runs against a
 * real repository for the reason every git test here does: what is relied on is
 * git's own behaviour — which files a commit takes when staged one group at a
 * time — and a fixture would only agree with itself.
 */

const run = promisify(execFile)

async function git(dir: string, ...args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd: dir })
  return stdout
}

async function repository(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "vsclaude-commit-plan-"))
  await git(root, "init", "--initial-branch", "main")
  await git(root, "config", "user.email", "test@example.com")
  await git(root, "config", "user.name", "Test")
  await git(root, "config", "core.autocrlf", "false")
  return root
}

function lines(out: string): string[] {
  return out.split("\n").filter(Boolean)
}

async function main() {
  section("reading a plan")

  const staged = ["src/a.ts", "src/b.ts", "docs/readme.md"]

  const split = readPlan(
    JSON.stringify({
      commits: [
        { files: ["src/a.ts"], message: "feat: a" },
        { files: ["src/b.ts", "docs/readme.md"], message: "docs: b" },
      ],
    }),
    staged
  )
  check(
    "a plan is read as its commits, in order",
    JSON.stringify(split) ===
      JSON.stringify([
        { message: "feat: a", files: ["src/a.ts"] },
        { message: "docs: b", files: ["src/b.ts", "docs/readme.md"] },
      ]),
    split
  )

  const fenced = readPlan(
    'Here you go:\n```json\n{"commits":[{"files":["src/a.ts","src/b.ts","docs/readme.md"],"message":"feat: all"}]}\n```',
    staged
  )
  check(
    "a code fence and words around the object are tolerated",
    fenced?.length === 1 && fenced[0]?.message === "feat: all",
    fenced
  )

  const plainText = readPlan("feat: just a sentence", staged)
  check(
    "plain text is one commit over everything staged, as a draft always was",
    JSON.stringify(plainText) ===
      JSON.stringify([{ message: "feat: just a sentence", files: staged }]),
    plainText
  )

  const unplaced = readPlan(
    JSON.stringify({
      commits: [{ files: ["src/a.ts"], message: "feat: a" }],
    }),
    staged
  )
  check(
    "files the answer leaves out land in the last commit",
    unplaced?.length === 1 &&
      JSON.stringify(unplaced[0]?.files) ===
        JSON.stringify(["src/a.ts", "src/b.ts", "docs/readme.md"]),
    unplaced
  )

  const invented = readPlan(
    JSON.stringify({
      commits: [
        { files: ["src/a.ts", "src/not-staged.ts", "src/a.ts"], message: "a" },
        { files: ["src/a.ts", "src/b.ts"], message: "b" },
        { files: ["src/b.ts", "docs/readme.md"], message: "" },
      ],
    }),
    staged
  )
  check(
    "a path that is not staged is ignored, a file named twice keeps its first place, and a commit with no message is dropped",
    JSON.stringify(invented) ===
      JSON.stringify([
        { message: "a", files: ["src/a.ts"] },
        { message: "b", files: ["src/b.ts", "docs/readme.md"] },
      ]),
    invented
  )

  const many = Array.from(
    { length: MAX_DRAFT_COMMITS + 2 },
    (_, index) => `f${index}.ts`
  )
  const capped = readPlan(
    JSON.stringify({
      commits: many.map((file, index) => ({
        files: [file],
        message: `commit ${index}`,
      })),
    }),
    many
  )
  check(
    "a plan is capped, and what the cap cut off is still in a commit",
    capped?.length === MAX_DRAFT_COMMITS &&
      capped.flatMap((commit) => commit.files).length === many.length,
    capped
  )

  check("an empty answer is no plan", readPlan("  ", staged) === null)
  check(
    "a plan naming nothing staged, with nothing to place, is no plan",
    readPlan(
      JSON.stringify({ commits: [{ files: ["x"], message: "m" }] }),
      []
    ) === null
  )

  section("committing a series")

  const root = await repository()
  await writeFile(path.join(root, "seed.txt"), "seed\n")
  await git(root, "add", ".")
  await git(root, "commit", "-m", "seed")

  await mkdir(path.join(root, "src"))
  await writeFile(path.join(root, "src", "a.ts"), "a\n")
  await writeFile(path.join(root, "src", "b.ts"), "b\n")
  await writeFile(path.join(root, "readme.md"), "doc\n")
  await git(root, "add", "src/a.ts", "src/b.ts", "readme.md")

  const made = await commitSeries(root, [
    { message: "feat: a", files: ["src/a.ts"] },
    { message: "feat: b", files: ["src/b.ts"] },
    { message: "docs: readme", files: ["readme.md"] },
  ])
  check("three commits are made", made.length === 3, made)
  check(
    "they land in the order given, each with its own message",
    JSON.stringify(
      lines(await git(root, "log", "--format=%s", "-n3")).reverse()
    ) === JSON.stringify(["feat: a", "feat: b", "docs: readme"])
  )
  check(
    "each commit takes only its own files",
    lines(await git(root, "show", "--name-only", "--format=", "HEAD~2")).join(
      ","
    ) === "src/a.ts" &&
      lines(await git(root, "show", "--name-only", "--format=", "HEAD~1")).join(
        ","
      ) === "src/b.ts"
  )
  check("nothing is left staged", (await stagedPaths(root)).length === 0)

  section("refusing what the draft did not show")

  await writeFile(path.join(root, "src", "a.ts"), "a\n")
  await writeFile(path.join(root, "src", "c.ts"), "c\n")
  await git(root, "add", "src/a.ts", "src/c.ts")
  const head = (await git(root, "rev-parse", "HEAD")).trim()

  const moved = await commitSeries(root, [
    { message: "feat: a", files: ["src/a.ts"] },
  ]).then(
    () => "committed",
    (failed: Error) => failed.message
  )
  check(
    "a file staged since the draft is refused, not left out silently",
    moved.startsWith("What is staged has changed"),
    moved
  )
  check(
    "a refusal makes no commit",
    (await git(root, "rev-parse", "HEAD")).trim() === head
  )

  await git(root, "reset", "-q")
  await writeFile(path.join(root, "src", "c.ts"), "c changed again\n")
  await git(root, "add", "src/c.ts")
  await writeFile(path.join(root, "src", "c.ts"), "c changed a third time\n")
  const partial = await commitSeries(root, [
    { message: "feat: c", files: ["src/c.ts"] },
  ]).then(
    () => "committed",
    (failed: Error) => failed.message
  )
  check(
    "a file with unstaged edits too is refused, since staging it would take them",
    partial.includes("also has changes that are not staged"),
    partial
  )

  // A commit git refuses partway through is reported with how many went in.
  await git(root, "reset", "-q")
  await rm(path.join(root, "src", "c.ts"))
  await writeFile(path.join(root, "src", "d.ts"), "d\n")
  await writeFile(path.join(root, "src", "e.ts"), "e\n")
  await git(root, "add", "src/d.ts", "src/e.ts")
  // A hook that refuses the commit of `e` alone, so the second of two fails.
  const hook = path.join(root, "refuse-e")
  await writeFile(
    hook,
    '#!/bin/sh\n[ "$(git diff --cached --name-only)" = "src/e.ts" ] && exit 1\nexit 0\n'
  )
  await chmod(hook, 0o755)
  await git(root, "config", "core.hooksPath", root)
  await rename(hook, path.join(root, "pre-commit"))
  const failing = await commitSeries(root, [
    { message: "feat: d", files: ["src/d.ts"] },
    { message: "feat: e", files: ["src/e.ts"] },
  ]).then(
    () => "committed",
    (failed: Error) => failed.message
  )
  check(
    "a refused commit says which one, and how many went in before it",
    failing.startsWith("Commit 2 of 2 was refused (1 made before it)"),
    failing
  )
  check(
    "the commit before the refusal stays",
    lines(await git(root, "log", "--format=%s", "-n1")).join("") === "feat: d"
  )

  await rm(root, { recursive: true, force: true })
  finish()
}

void main()
