import { useEffect, useRef, useState } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useProjects } from "@/lib/projects"
import { useShells } from "@/lib/shell/store"
import { useStudio } from "@/lib/store"
import { worktreeBranches } from "@/lib/workspace"
import type { WorkspaceFolder } from "@shared/api"

/**
 * An entry in the base list: a ref's name, and whether it is the typed text
 * offered as a ref of its own (a tag, a commit) rather than a branch the
 * repository listed.
 */
type BranchOption = { value: string; typed?: boolean }
type BranchGroup = { label: string; items: BranchOption[] }

/**
 * A branch and what to cut it from, for `git worktree add` — the checkout then
 * joins its project's chats under a heading of its own and is picked, so the
 * next chat or shell is opened in it rather than in the project's directory.
 *
 * `Branch` is free text: it names a branch nobody has made yet, which no list
 * could offer. `Based on` is the shadcn `Combobox` over the repository's
 * branches, local and remote, with the typed text offered last as
 * `Use “…”` for a tag or a commit; cleared, it is HEAD. A `Branch` that
 * already exists locally is checked out as it is (`addWorktree`), so `Based
 * on` is switched off and says so rather than being quietly ignored.
 *
 * Mount it only while asked (`{worktreeOf && …}`), like `RenameDialog`. Locked
 * while git works: a large repository takes seconds to check out, and a second
 * press would be a second `worktree add` racing the first for the directory.
 */
export function NewWorktreeDialog({
  folder,
  onClose,
}: {
  folder: WorkspaceFolder
  onClose: () => void
}) {
  const branchNow = useStudio((state) => state.branches[folder.id] ?? null)
  const [branch, setBranch] = useState("")
  const [base, setBase] = useState<BranchOption | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [known, setKnown] = useState<{ local: string[]; remote: string[] }>({
    local: [],
    remote: [],
  })
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let current = true
    // A list that never comes back still leaves `Use “…”` for a typed base,
    // and HEAD for none.
    worktreeBranches(folder.id)
      .then((listed) => current && setKnown(listed))
      .catch(() => {})
    return () => {
      current = false
    }
  }, [folder.id])

  const baseGroups: BranchGroup[] = [
    { label: "Local", items: known.local.map((value) => ({ value })) },
    { label: "Remote", items: known.remote.map((value) => ({ value })) },
  ].filter((group) => group.items.length > 0)
  const name = branch.trim()
  const existing = known.local.includes(name)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (busy || !name) return
    setBusy(true)
    setError(null)
    try {
      const id = await useStudio.getState().addWorktree({
        folderId: folder.id,
        branch: name,
        base: existing ? undefined : base?.value,
      })
      if (id) {
        useProjects.getState().setActive(id)
        useShells.getState().showFor(id)
        useProjects.getState().showView("projects")
      }
      onClose()
    } catch (failure) {
      setBusy(false)
      setError(
        (failure instanceof Error ? failure.message : String(failure)).replace(
          /^Error invoking remote method '[^']+': (?:Error: )?/,
          ""
        )
      )
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !busy) onClose()
      }}
    >
      <DialogContent initialFocus={field}>
        <DialogHeader>
          <DialogTitle>New worktree</DialogTitle>
          <DialogDescription>
            A second checkout of “{folder.name}”, kept inside the project, so a
            chat there works on its own files and branch.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="worktree-branch">Branch</Label>
            <Input
              id="worktree-branch"
              ref={field}
              value={branch}
              onChange={(event) => setBranch(event.target.value)}
              placeholder="feature/my-change"
              spellCheck={false}
              autoComplete="off"
              disabled={busy}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {existing
                ? `“${name}” already exists — it is checked out as it is.`
                : "A new branch, cut from the one below."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="worktree-base">Based on</Label>
            <BranchCombobox
              id="worktree-base"
              value={base}
              onChange={setBase}
              groups={baseGroups}
              placeholder={branchNow ?? "HEAD"}
              disabled={busy || existing}
            />
            <p className="text-xs text-muted-foreground">
              Empty is what is checked out now
              {branchNow ? ` (${branchNow})` : ""}.
            </p>
          </div>
          {error && (
            <p className="font-mono text-xs whitespace-pre-wrap text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name}>
              {busy ? "Creating…" : "Create worktree"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * One ref out of `groups`, or the typed text when it names none of them —
 * offered last as `Use “…”`, and only while the query matches no entry
 * exactly, so picking a listed branch never offers it a second time.
 */
function BranchCombobox({
  id,
  value,
  onChange,
  groups,
  placeholder,
  disabled,
}: {
  id: string
  value: BranchOption | null
  onChange: (value: BranchOption | null) => void
  groups: BranchGroup[]
  placeholder: string
  disabled: boolean
}) {
  const [query, setQuery] = useState(value?.value ?? "")
  const typed = query.trim()
  const exact = groups.some((group) =>
    group.items.some((item) => item.value === typed)
  )
  const items: BranchGroup[] =
    typed && !exact
      ? [...groups, { label: "Other", items: [{ value: typed, typed: true }] }]
      : groups

  return (
    <Combobox
      items={items}
      value={value}
      onValueChange={(next: BranchOption | null) => onChange(next)}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={(item: BranchOption) => item.value}
      isItemEqualToValue={(item: BranchOption, current: BranchOption) =>
        item.value === current.value && !!item.typed === !!current.typed
      }
      autoHighlight
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
        showClear={value !== null}
        disabled={disabled}
        className="w-full font-mono"
      />
      <ComboboxContent>
        <ComboboxEmpty>No branches.</ComboboxEmpty>
        <ComboboxList>
          {(group: BranchGroup) => (
            <ComboboxGroup key={group.label} items={group.items}>
              <ComboboxLabel>{group.label}</ComboboxLabel>
              <ComboboxCollection>
                {(item: BranchOption) => (
                  <ComboboxItem
                    key={`${group.label}:${item.value}`}
                    value={item}
                    className="font-mono text-xs"
                  >
                    {item.typed && <Plus className="text-muted-foreground" />}
                    <span className="min-w-0 flex-1 truncate">
                      {item.typed ? `Use “${item.value}”` : item.value}
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
