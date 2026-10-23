import type { ComponentType, ReactNode } from "react"
import { create } from "zustand"
import {
  ArrowDown,
  ArrowUp,
  ClipboardCopy,
  ExternalLink,
  Image as ImageIcon,
  ImageOff,
  MessageSquare,
  Pencil,
  SquareTerminal,
  Trash2,
  X,
} from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { chooseProjectIcon, resetProjectIcon } from "@/lib/project-icon"
import { useStudio } from "@/lib/store"
import { useShells } from "@/lib/shell/store"
import { useChats } from "@/lib/chat/store"
import type { WorkspaceFolder } from "@shared/api"
import { IconButton } from "../icon-button"
import { RenameDialog } from "../rename-dialog"

/**
 * Which project a confirmation is up for, and the last refusal.
 *
 * A store rather than state on the component that asks, because two places ask
 * — a project's icon in the rail and the `…` on the column's header — and a
 * dialog owned by either is unmounted by the very removal it is confirming. One
 * `ProjectDialogs`, mounted once by the studio, draws whichever is up.
 */
type ProjectDialogsState = {
  removing: WorkspaceFolder | null
  renaming: WorkspaceFolder | null
  trashing: WorkspaceFolder | null
  /** A failed Trash or icon change. Shown under the projects column, since
   * the confirmation that asked is gone by the time main answers. */
  failure: string | null
  set: (patch: Partial<Omit<ProjectDialogsState, "set">>) => void
}

export const useProjectDialogs = create<ProjectDialogsState>((set) => ({
  removing: null,
  renaming: null,
  trashing: null,
  failure: null,
  set: (patch) => set(patch),
}))

/** What a menu item is, for both menus that list a project's actions. */
type ItemProps = {
  onClick: () => void
  disabled?: boolean
  variant?: "default" | "destructive"
  children: ReactNode
}

/**
 * A project's actions, as items of whichever menu is drawing them.
 *
 * The rail's icon right-clicks to a `ContextMenu` and the header's `…` drops a
 * `DropdownMenu`; the two take the same item and separator props, so the list
 * is written once and handed the two components rather than kept twice. The
 * order and the two destructive items' argument are the ones the old project
 * row carried: "Remove", not "Delete", because the directory is the user's own
 * and stays; `Move to Trash…` only on a directory this app made from a
 * template, last, below the one that only forgets.
 */
export function ProjectMenuItems({
  folder,
  Item,
  Separator,
}: {
  folder: WorkspaceFolder
  Item: ComponentType<ItemProps>
  Separator: ComponentType
}) {
  const dialogs = useProjectDialogs.getState()
  // Read when the menu opens rather than subscribed to: a menu is up for one
  // decision, and the list does not move under it.
  const folders = useStudio.getState().folders
  const index = folders.findIndex((entry) => entry.id === folder.id)
  const move = (to: number) =>
    void useStudio.getState().moveFolder(folder.id, to)
  return (
    <>
      <Item
        onClick={() => void useChats.getState().create({ folderId: folder.id })}
      >
        <MessageSquare className="text-muted-foreground" />
        New chat here
      </Item>
      <Item
        onClick={() => {
          // Pointing the dock first is what makes `add` open the shell here
          // rather than in whichever project was clicked last.
          const shells = useShells.getState()
          shells.showFor(folder.id)
          shells.add()
        }}
      >
        <SquareTerminal className="text-muted-foreground" />
        New terminal here
      </Item>
      <Item onClick={() => dialogs.set({ renaming: folder })}>
        <Pencil className="text-muted-foreground" />
        Rename…
      </Item>
      <Separator />
      {/* The rail's drag, for somebody not holding a mouse. */}
      <Item disabled={index <= 0} onClick={() => move(index - 1)}>
        <ArrowUp className="text-muted-foreground" />
        Move up
      </Item>
      <Item
        disabled={index === -1 || index >= folders.length - 1}
        onClick={() => move(index + 1)}
      >
        <ArrowDown className="text-muted-foreground" />
        Move down
      </Item>
      <Separator />
      <Item onClick={() => void navigator.clipboard.writeText(folder.path)}>
        <ClipboardCopy className="text-muted-foreground" />
        Copy path
      </Item>
      <Item onClick={() => void window.desktop.revealPath(folder.path)}>
        <ExternalLink className="text-muted-foreground" />
        Reveal in file manager
      </Item>
      <Separator />
      <Item
        onClick={() => {
          dialogs.set({ failure: null })
          void chooseProjectIcon(folder.id).catch((error: unknown) =>
            dialogs.set({ failure: messageOf(error) })
          )
        }}
      >
        <ImageIcon className="text-muted-foreground" />
        Change icon…
      </Item>
      <Item onClick={() => void resetProjectIcon(folder.id)}>
        <ImageOff className="text-muted-foreground" />
        Reset icon
      </Item>
      <Separator />
      <Item
        variant="destructive"
        onClick={() => dialogs.set({ removing: folder })}
      >
        <Trash2 />
        Remove project
      </Item>
      {folder.template && (
        <Item
          variant="destructive"
          onClick={() => dialogs.set({ trashing: folder })}
        >
          <Trash2 />
          Move to Trash…
        </Item>
      )}
    </>
  )
}

/** The confirmations and the rename, for whichever project asked. Mounted
 * once, by the studio. */
export function ProjectDialogs() {
  const { removing, renaming, trashing, set } = useProjectDialogs()

  return (
    <>
      <AlertDialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) set({ removing: null })
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this project?</AlertDialogTitle>
            {/* The same sentence Explorer's own dialog says: this is the same
                call, and a second wording would leave somebody comparing the
                two to work out whether their repository is at stake. */}
            <AlertDialogDescription>
              The folder stays on disk.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (removing)
                  void useStudio.getState().removeFolder(removing.id)
                set({ removing: null })
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={trashing !== null}
        onOpenChange={(next) => {
          if (!next) set({ trashing: null })
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move “{trashing?.name}” to the Trash?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The folder goes to the Trash with everything in it, and its chats
              are deleted. Its terminals are closed first.
            </AlertDialogDescription>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {trashing?.path}
            </p>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const target = trashing
                set({ trashing: null, failure: null })
                if (!target) return
                // A shell whose cwd is inside it holds the directory open, and
                // Windows refuses to move it. Main retries while the ptys end.
                const shells = useShells.getState()
                for (const shell of shells.shells) {
                  if (shell.folderId === target.id) shells.close(shell.id)
                }
                void useStudio
                  .getState()
                  .trashProject(target.id)
                  .then(() => useChats.getState().refresh())
                  .catch((error: unknown) =>
                    set({
                      failure: messageOf(error).replace(
                        /^Error invoking remote method '[^']+': (?:Error: )?/,
                        ""
                      ),
                    })
                  )
              }}
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {renaming && (
        <RenameDialog
          title="Rename project"
          label="Project name"
          currentName={renaming.name}
          onRename={async (name) => {
            try {
              await useStudio.getState().renameFolder(renaming.id, name)
              return null
            } catch (error) {
              return error instanceof Error
                ? error.message
                : "Could not rename that project."
            }
          }}
          onClose={() => set({ renaming: null })}
        />
      )}
    </>
  )
}

/** The last refusal, under the column it was about. It stays until the next
 * attempt or until it is shut. */
export function ProjectFailure() {
  const failure = useProjectDialogs((state) => state.failure)
  const set = useProjectDialogs((state) => state.set)
  if (!failure) return null
  return (
    <div className="flex shrink-0 items-start gap-1 border-t bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
      <p className="min-w-0 flex-1">{failure}</p>
      <IconButton
        label="Dismiss"
        onClick={() => set({ failure: null })}
        className="size-5 shrink-0"
      >
        <X className="size-3" />
      </IconButton>
    </div>
  )
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
