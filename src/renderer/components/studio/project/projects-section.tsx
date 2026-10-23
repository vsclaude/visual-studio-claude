import { useState, type ReactNode } from "react"
import { MoreHorizontal, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useProjects } from "@/lib/projects"
import { useStudio } from "@/lib/store"
import { chatsOf, ungroupedChats, useChats } from "@/lib/chat/store"
import { columnSections } from "@/lib/chat/column"
import type { Chat, WorkspaceFolder } from "@shared/api"
import { IconButton } from "../icon-button"
import { SideRow } from "../side-row"
import { AccountsFooter } from "./accounts"
import { ChatList } from "./chat-list"
import { ProjectFailure, ProjectMenuItems } from "./project-actions"

/**
 * The chats this column lists: the ones that are on disk.
 *
 * A `+` opens a tab before anything has been said in it — the chat is held in
 * `unsaved` until its first message writes it down. The strip is what is open
 * in this run and so shows it at once; this column is where a conversation from
 * last week is found again, and a row for a chat that will leave no file if the
 * tab is shut is a row that disappears without anybody deleting it.
 */
function saved(chats: Chat[], unsaved: string[]): Chat[] {
  if (unsaved.length === 0) return chats
  return chats.filter((chat) => !unsaved.includes(chat.id))
}

/**
 * **One project's chats**, the project picked in the rail.
 *
 * It was a tree of every project, each folded open or shut, with a shut
 * project saying what was inside it as a count. That is the wrong shape for
 * what this app is for — several chats on several accounts at once — because
 * the way somebody does that is to start a chat, fold its project away and
 * start another, and a column of folded projects is a column that says almost
 * nothing. The projects moved to the rail (`ProjectRail`), each icon carrying
 * the one badge worth reading, and this column is the chats of the one picked:
 * what needs somebody, what is running, and the rest — and at its foot, how
 * much each account has left. `docs/design.md` § Projects and chats.
 */
export function ProjectsSection({ onAddFolder }: { onAddFolder: () => void }) {
  const folders = useStudio((state) => state.folders)
  const branches = useStudio((state) => state.branches)
  const activeFolderId = useProjects((state) => state.activeFolderId)
  const showingUngrouped = useProjects((state) => state.ungrouped)
  const chats = useChats((state) => state.chats)
  const unsaved = useChats((state) => state.unsaved)

  const listed = saved(chats, unsaved)
  const orphans = ungroupedChats(listed)
  // Only while there is something in it: the last ungrouped chat deleted leaves
  // the column on the project rather than on an empty list with no `+`, and
  // the rail stops drawing the icon that picked it.
  const ungrouped = showingUngrouped && orphans.length > 0
  // The active project, or the first one for an id that names nothing — the
  // same fallback Explorer's `shownRoot` makes, so the two never disagree about
  // which project is on screen.
  const folder =
    folders.find((entry) => entry.id === activeFolderId) ?? folders[0] ?? null

  if (!ungrouped && !folder) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-xs leading-relaxed text-muted-foreground">
          A project is a folder on this machine. Its chats run in it.
        </p>
        <Button size="sm" onClick={onAddFolder}>
          <Plus />
          Add project
        </Button>
      </div>
    )
  }

  const own = ungrouped ? orphans : chatsOf(listed, folder!.id)

  return (
    <nav
      aria-label="Chats"
      className="flex h-full min-h-0 flex-col overflow-hidden"
    >
      {ungrouped ? (
        <Header
          title="Ungrouped"
          caption="Chats whose project has left the workspace"
        />
      ) : (
        <ProjectHeader folder={folder!} branch={branches[folder!.id] ?? null} />
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
        <Sections chats={own} />
      </div>

      <ProjectFailure />
      <AccountsFooter />
    </nav>
  )
}

/** A column header: a title, a line under it, and whatever acts on it. */
function Header({
  title,
  caption,
  children,
}: {
  title: string
  caption: string
  children?: ReactNode
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b py-2 pr-2 pl-3">
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-[0.8125rem] font-semibold">{title}</h2>
        <p className="truncate text-[0.6875rem] text-muted-foreground">
          {caption}
        </p>
      </div>
      {children}
    </div>
  )
}

/**
 * The picked project: its name, where it is and what is checked out, a `+`
 * for a chat in it, and its menu — the same items its icon in the rail
 * right-clicks to.
 */
function ProjectHeader({
  folder,
  branch,
}: {
  folder: WorkspaceFolder
  branch: string | null
}) {
  return (
    <Header
      title={folder.name}
      caption={[tildePath(folder.path), branch].filter(Boolean).join(" · ")}
    >
      <Button
        size="xs"
        onClick={() => void useChats.getState().create({ folderId: folder.id })}
        title={`New chat in ${folder.name}`}
      >
        <Plus />
        Chat
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <IconButton label="Project" side="bottom" className="size-6">
              <MoreHorizontal />
            </IconButton>
          }
        />
        <DropdownMenuContent align="end" className="w-52">
          <ProjectMenuItems
            folder={folder}
            Item={DropdownMenuItem}
            Separator={DropdownMenuSeparator}
          />
        </DropdownMenuContent>
      </DropdownMenu>
    </Header>
  )
}

/** `/Users/me/work/app` as `~/work/app`, which is what fits a header. The home
 * directory is read off the path itself — the renderer cannot ask for it. */
function tildePath(path: string): string {
  return path.replace(/^\/(?:Users|home)\/[^/]+(?=\/|$)/, "~")
}

/** How many of the `Recent` chats are listed before `View all`. A project
 * with months of chats otherwise pushes the accounts off the column. */
const CHAT_LIMIT = 20

/**
 * The project's chats in their three sections — see `columnSections`. A
 * section with nothing in it draws nothing, and `Recent` loses its label when
 * it is the only section there is, since a label over the whole list names
 * nothing.
 */
function Sections({ chats }: { chats: Chat[] }) {
  const sending = useChats((state) => state.sending)
  const asks = useChats((state) => state.asks)
  const unread = useChats((state) => state.unread)
  const selectedId = useChats((state) => state.selectedId)
  const [showAll, setShowAll] = useState(false)

  if (chats.length === 0) {
    return (
      <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        No chats yet. Start one with the button above.
      </p>
    )
  }

  const { needsYou, running, recent } = columnSections(
    chats,
    sending,
    asks,
    unread
  )
  const hidden = recent.length - CHAT_LIMIT
  const shown = showAll || hidden <= 0 ? recent : recent.slice(0, CHAT_LIMIT)
  // The selected chat stays listed past the cut: a chat picked from the tab
  // strip with no row lit for it reads as the column having lost it.
  const selected = recent.find((chat) => chat.id === selectedId)
  const rows =
    selected && !shown.includes(selected) ? [...shown, selected] : shown
  const alone = needsYou.length === 0 && running.length === 0

  return (
    <>
      {needsYou.length > 0 && (
        <Section label="Needs you" tone="primary">
          <ChatList chats={needsYou} />
        </Section>
      )}
      {running.length > 0 && (
        <Section label="Running">
          <ChatList chats={running} />
        </Section>
      )}
      {recent.length > 0 && (
        <Section label={alone ? null : "Recent"}>
          <ChatList chats={rows} />
          {hidden > 0 && (
            <SideRow
              className="rounded-md text-[0.6875rem]"
              onClick={() => setShowAll((all) => !all)}
            >
              <span className="min-w-0 flex-1 truncate text-left">
                {showAll ? "Show less" : `View all (${recent.length})`}
              </span>
            </SideRow>
          )}
        </Section>
      )}
    </>
  )
}

function Section({
  label,
  tone,
  children,
}: {
  label: string | null
  tone?: "primary"
  children: ReactNode
}) {
  return (
    <section className="mb-2 last:mb-0">
      {label && (
        <h3
          className={cn(
            "px-3 pt-1.5 pb-1 text-[0.625rem] font-medium tracking-wider uppercase",
            tone === "primary" ? "text-primary" : "text-muted-foreground"
          )}
        >
          {label}
        </h3>
      )}
      {children}
    </section>
  )
}
