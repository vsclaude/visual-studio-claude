import { useEffect, useState, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  ArrowUpCircle,
  AudioLines,
  Bell,
  Columns2,
  ExternalLink,
  Palette,
  FileArchive,
  FolderOpen,
  Puzzle,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react"

import {
  ACCENT_PALETTES,
  isDensity,
  isFontSize,
  isMonoFont,
  isSansFont,
  MONO_FONT_LABELS,
  monoFontFamily,
  PALETTE_LABELS,
  SANS_FONT_LABELS,
  sansFontFamily,
} from "@/lib/appearance"
import { useAppBackground } from "@/lib/app-background"
import type { ClaudeVersions } from "@shared/api"
import {
  MEDIA_PROVIDER_LABELS,
  MEDIA_PROVIDERS,
  type MediaKeyStatus,
  type MediaProvider,
} from "@shared/media"
import { isOn, usePlugins, type PluginStatus } from "@/lib/plugins/store"
import { useSettings } from "@/lib/settings"
import { installLabel, pendingUpdate, useUpdates } from "@/lib/updates"
import { useClaudeProfiles } from "@/lib/chat/claude-profiles"
import { useAgentModels } from "@/lib/chat/models"
import { useFreeAi } from "@/lib/free-ai"
import { FREE_PROFILE_ID } from "@shared/free-ai"
import { IconButton } from "./icon-button"
import { OfficialBadge } from "./official-badge"
import { UpdateProgressBar } from "./update-progress"
import { ModelMenu, ProfileMenu } from "./chat/chat-composer"

/**
 * The studio's preferences — **Settings…** in the application menu, ⌘,.
 *
 * A dialog rather than a panel with a tab of its own: what is here is about
 * the workbench itself rather than about anything in the workspace, and a
 * preference read once and closed does not want a place in the strip beside
 * the files it is being read about. It is also the only honest home for a
 * setting whose effect *is* the strip — a tab is a poor place to be holding
 * the switch that moves the tabs.
 *
 * Laid out the way every settings window of this shape is: sections down the
 * left, one section's rows on the right, each row a name and a sentence with
 * its control at the far end. That is not decoration — it is what keeps the
 * dialog the same size as it grows. A single scrolling column is fine for the
 * three settings there are today and stops being fine at ten, and a list of
 * sections is also the only thing that says what *kinds* of preference exist
 * without reading all of them.
 *
 * There is no Save: a preference applies as it is picked, which is what makes
 * the studio behind the dialog its own preview. Everything written here goes
 * through `lib/settings.ts` and lands in the workspace's own settings, so it
 * survives a relaunch the way the strip's arrangement does.
 */
export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<SectionId>("appearance")

  const current = SECTIONS.find((candidate) => candidate.id === section)!

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="grid h-[34rem] max-h-[85vh] w-full grid-cols-[12rem_1fr] gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <nav
          aria-label="Settings sections"
          className="flex min-h-0 flex-col gap-0.5 overflow-y-auto border-r bg-muted/30 p-2"
        >
          <p className="px-2 pt-1 pb-2 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
            Options
          </p>
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              // `aria-current` rather than `role="tab"`: these are pages of a
              // dialog, not tabs of a panel, and the panel beside them is not
              // a tabpanel anyone should be able to arrow through.
              aria-current={id === section ? "page" : undefined}
              onClick={() => setSection(id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                id === section
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </button>
          ))}
        </nav>

        <div className="flex min-h-0 min-w-0 flex-col">
          {/* `pr-12` clears the close button, which the dialog draws in the
              corner over whatever is there. */}
          <header className="shrink-0 border-b px-5 py-4 pr-12">
            <DialogTitle>{current.label}</DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              {current.blurb}
            </DialogDescription>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {section === "appearance" ? (
              <AppearanceSection onReplayTour={onClose} />
            ) : section === "tabs" ? (
              <TabsSection />
            ) : section === "chats" ? (
              <ChatsSection />
            ) : section === "media" ? (
              <MediaSection />
            ) : section === "plugins" ? (
              <PluginsSection />
            ) : (
              <UpdatesSection />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type SectionId =
  "appearance" | "tabs" | "chats" | "media" | "plugins" | "updates"

/** The sections, in the order they are listed. Each one is a heading, a line
 * saying what it covers, and the rows below — kept together so adding a
 * section is one entry rather than three edits. */
const SECTIONS: {
  id: SectionId
  label: string
  blurb: string
  icon: LucideIcon
}[] = [
  {
    id: "appearance",
    label: "Appearance",
    blurb: "How the studio looks.",
    icon: Palette,
  },
  {
    id: "tabs",
    label: "Tabs & editor",
    blurb: "The tab strip and the editor.",
    icon: Columns2,
  },
  {
    id: "chats",
    label: "Chats",
    blurb: "Notifications, and the model commit drafts run on.",
    icon: Bell,
  },
  {
    id: "media",
    label: "Media",
    blurb: "Services a chat can generate audio with, on your own account.",
    icon: AudioLines,
  },
  {
    id: "plugins",
    label: "Plugins",
    blurb: "Code of your own, run in the studio.",
    icon: Puzzle,
  },
  {
    id: "updates",
    label: "Updates",
    blurb: "Version and updates.",
    icon: ArrowUpCircle,
  },
]

/**
 * How the studio looks. Every row here applies as it is picked — the window
 * behind the dialog is the preview — through `applyAppearance`, which the
 * workbench subscribes to the settings store with; nothing in this section
 * touches the document itself.
 */
function AppearanceSection({ onReplayTour }: { onReplayTour: () => void }) {
  // `theme` is the choice, `resolvedTheme` what it came out as — the choice is
  // what a settings row is asking about, so `system` stays visible as `system`
  // rather than as whichever of the two it happens to be right now.
  const { theme, setTheme } = useTheme()
  const palette = useSettings((state) => state.palette)
  const setPalette = useSettings((state) => state.setPalette)
  const fontSans = useSettings((state) => state.fontSans)
  const setFontSans = useSettings((state) => state.setFontSans)
  const fontMono = useSettings((state) => state.fontMono)
  const setFontMono = useSettings((state) => state.setFontMono)
  const fontSize = useSettings((state) => state.fontSize)
  const setFontSize = useSettings((state) => state.setFontSize)
  const density = useSettings((state) => state.density)
  const setDensity = useSettings((state) => state.setDensity)
  const setOnboarded = useSettings((state) => state.setOnboarded)
  const backgroundImage = useAppBackground((state) => state.image)
  const chooseBackground = useAppBackground((state) => state.choose)
  const clearBackground = useAppBackground((state) => state.clear)
  const [backgroundError, setBackgroundError] = useState<string | null>(null)

  return (
    <div className="space-y-4">
      <Card>
        <Row title="Theme" description="Follow the system, or pick one.">
          <Segmented
            value={theme ?? "system"}
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            onPick={setTheme}
          />
        </Row>
        <Row
          title="Accent"
          description="Buttons, selections and the active row."
        >
          <div role="radiogroup" className="flex items-center gap-1.5">
            {ACCENT_PALETTES.map((candidate) => (
              <button
                key={candidate}
                type="button"
                role="radio"
                aria-checked={candidate === palette}
                aria-label={PALETTE_LABELS[candidate]}
                title={PALETTE_LABELS[candidate]}
                // The swatch is the palette's own `--primary`: the same
                // `[data-palette]` rule the window reads, on a span instead of
                // `<html>`, so there is no second table of colours to keep in
                // step. It is the light accent in both modes, since the dark
                // rule wants `.dark` on the same element.
                data-palette={candidate}
                onClick={() => setPalette(candidate)}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  candidate === palette
                    ? "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                    : "ring-1 ring-border"
                )}
              >
                <span className="size-4 rounded-full bg-primary" />
              </button>
            ))}
          </div>
        </Row>
      </Card>

      <Card>
        <Row title="Font" description="The interface font.">
          <FontPicker
            value={fontSans}
            labels={SANS_FONT_LABELS}
            onPick={(value) => {
              if (isSansFont(value)) setFontSans(value)
            }}
          />
        </Row>
        <Row
          title="Monospace font"
          description="Editors, diffs and the terminal."
        >
          <FontPicker
            value={fontMono}
            labels={MONO_FONT_LABELS}
            onPick={(value) => {
              if (isMonoFont(value)) setFontMono(value)
            }}
          />
        </Row>
        <Row title="Font size" description="Scales the whole window.">
          <Segmented
            value={fontSize}
            options={[
              { value: "small", label: "Small" },
              { value: "default", label: "Default" },
              { value: "large", label: "Large" },
            ]}
            onPick={(value) => {
              if (isFontSize(value)) setFontSize(value)
            }}
          />
        </Row>
        <Row
          title="Density"
          description="Spacing of sidebar rows and chat turns."
        >
          <Segmented
            value={density}
            options={[
              { value: "compact", label: "Compact" },
              { value: "comfortable", label: "Comfortable" },
              { value: "spacious", label: "Spacious" },
            ]}
            onPick={(value) => {
              if (isDensity(value)) setDensity(value)
            }}
          />
        </Row>
      </Card>

      <Card>
        <Row
          title="Background"
          description={
            backgroundError ? (
              <span className="text-destructive">{backgroundError}</span>
            ) : (
              "A picture behind the studio, seen in the gaps between panels and through them."
            )
          }
        >
          <div className="flex items-center gap-1.5">
            {backgroundImage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void clearBackground()}
              >
                Remove
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setBackgroundError(null)
                chooseBackground().catch((error: unknown) =>
                  setBackgroundError(messageOfError(error))
                )
              }}
            >
              {backgroundImage ? "Change picture…" : "Choose picture…"}
            </Button>
          </div>
        </Row>
      </Card>

      <Card>
        <Row title="Tour" description="The first-launch walkthrough.">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Unset first, then close: the tour is mounted by the workbench
              // off this flag, and it has to land over a window with no
              // dialog still holding focus.
              setOnboarded(false)
              onReplayTour()
            }}
          >
            Replay the tour
          </Button>
        </Row>
      </Card>
    </div>
  )
}

/** One of a short list of typefaces, each drawn in itself so the list is its
 * own preview — and so a family that is not installed is visibly the fallback
 * before it is picked. */
function FontPicker<Value extends string>({
  value,
  labels,
  onPick,
}: {
  value: Value
  labels: Record<Value, string>
  onPick: (value: string) => void
}) {
  const values = Object.keys(labels) as Value[]
  return (
    <Select
      value={value}
      items={labels}
      onValueChange={(next) => {
        if (typeof next === "string") onPick(next)
      }}
    >
      <SelectTrigger size="sm" className="w-52 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {values.map((candidate) => (
          <SelectItem
            key={candidate}
            value={candidate}
            className="text-xs"
            style={{ fontFamily: previewFamily(candidate) }}
          >
            {labels[candidate]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** The stack a row is drawn in: a key is a sans or a mono name, never both. */
function previewFamily(value: string): string {
  if (isMonoFont(value) && value !== "system") return monoFontFamily(value)
  if (isSansFont(value) && value !== "system") return sansFontFamily(value)
  return "inherit"
}

function TabsSection() {
  const allProjectTabs = useSettings((state) => state.allProjectTabs)
  const setAllProjectTabs = useSettings((state) => state.setAllProjectTabs)
  const gitBlame = useSettings((state) => state.gitBlame)
  const setGitBlame = useSettings((state) => state.setGitBlame)

  return (
    <Card>
      <Row
        title="Show tabs from every project"
        description="Off: only the project you are working in."
      >
        <Switch checked={allProjectTabs} onCheckedChange={setAllProjectTabs} />
      </Row>
      <Row
        title="Show who last changed the line"
        description="Git blame after the current line, like GitLens."
      >
        <Switch checked={gitBlame} onCheckedChange={setGitBlame} />
      </Row>
    </Card>
  )
}

/**
 * What a chat does when nobody is watching it.
 *
 * Its own section rather than a row under `Appearance`, because this is not
 * about how the studio looks: several chats answering at once is the thing this
 * app is for, and what makes that workable is being called back to one. The
 * section is where the rest of that belongs as it arrives.
 *
 * The commit-draft row came here from the Claude section when that went: the
 * accounts it listed are managed in the projects column's Accounts foot now,
 * and this was the one row of it that was not an account.
 */
function ChatsSection() {
  const on = useSettings((state) => state.chatNotifications)
  const setOn = useSettings((state) => state.setChatNotifications)

  const profiles = useClaudeProfiles((state) => state.profiles)
  const models = useAgentModels()
  const freeReady = useFreeAi((state) => state.ready)
  const reviewModel = useSettings((state) => state.reviewModel)
  const reviewEffort = useSettings((state) => state.reviewEffort)
  const reviewProfileId = useSettings((state) => state.reviewProfileId)
  const setReviewModel = useSettings((state) => state.setReviewModel)
  const setReviewProfileId = useSettings((state) => state.setReviewProfileId)

  return (
    <Card>
      {/*
        On by default, which is the other way round from every other switch in
        this dialog and is argued for on `CHAT_NOTIFICATIONS_KEY`: a user who
        has to find this row first has already missed the turn they walked away
        from.
      */}
      <Row
        title="Notify me when a chat finishes"
        description="When a chat finishes, fails or asks something, while the window is in the background."
      >
        <Switch checked={on} onCheckedChange={setOn} />
      </Row>
      {/* The one turn in the app with no toolbar of its own — a drafted
          commit message runs on whatever is picked here rather than on
          something asked per turn, since it is not a conversation somebody
          sits in front of. See `main/one-turn-agent.ts`; the `review*` field
          names are what is already on disk. */}
      <Row
        title="Commit message drafts"
        description="Model and account the Git tab's Draft button runs on."
      >
        <div className="flex items-center gap-1.5">
          <ModelMenu
            models={models}
            model={reviewModel}
            effort={reviewEffort}
            onPick={setReviewModel}
          />
          {/* The composer's own condition: credits are a choice even for
              somebody with no profile of their own. */}
          {(profiles.length > 0 ||
            freeReady ||
            reviewProfileId === FREE_PROFILE_ID) && (
            <ProfileMenu
              profiles={profiles}
              profileId={reviewProfileId}
              onPick={setReviewProfileId}
            />
          )}
        </div>
      </Row>
    </Card>
  )
}

/**
 * The media services' API keys — what lets a chat's `media` tools exist.
 *
 * A key is typed here once and never shown again: main seals it with the OS
 * keychain and tells this side only whether one is set (`MediaKeyStatus`), so
 * the row offers Replace and Remove rather than a field holding the secret.
 * No store: nothing else in the renderer needs to know, and the dialog asks
 * when it opens.
 */
function MediaSection() {
  const [status, setStatus] = useState<MediaKeyStatus | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void window.desktop
      .mediaKeys()
      .then((next) => {
        if (live) setStatus(next)
      })
      .catch((error: unknown) => {
        if (live) setFailure(messageOfError(error))
      })
    return () => {
      live = false
    }
  }, [])

  const save = async (provider: MediaProvider, key: string | null) => {
    setFailure(null)
    try {
      setStatus(await window.desktop.setMediaKey(provider, key))
      return true
    } catch (error) {
      setFailure(messageOfError(error))
      return false
    }
  }

  return (
    <div className="space-y-4">
      {status && !status.sealable && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed">
          This machine has no keychain the studio can seal a key with, so none
          can be saved — it would otherwise sit on disk in the clear.
        </p>
      )}

      <Card>
        {MEDIA_PROVIDERS.map((provider) => (
          <MediaKeyRow
            key={provider}
            provider={provider}
            saved={status?.keys[provider] ?? false}
            disabled={!status?.sealable}
            onSave={(key) => save(provider, key)}
          />
        ))}
      </Card>

      <p
        aria-live="polite"
        className={cn(
          "text-xs leading-relaxed",
          failure ? "text-destructive" : "text-muted-foreground"
        )}
      >
        {failure ??
          "With a key saved, a chat can generate audio when you ask it to, and writes the file into the project's media/ folder. Each one spends your credits with that service: Ask and Edits ask you first, Full access does not, and Plan and Read only never generate."}
      </p>
    </div>
  )
}

const MEDIA_PROVIDER_ABOUT: Record<MediaProvider, string> = {
  elevenlabs:
    "Speech and sound effects. A key is under Developers › API keys on elevenlabs.io.",
}

function MediaKeyRow({
  provider,
  saved,
  disabled,
  onSave,
}: {
  provider: MediaProvider
  saved: boolean
  disabled: boolean
  onSave: (key: string | null) => Promise<boolean>
}) {
  /** Typing a key — always, when none is saved; after Replace, when one is. */
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (key: string | null) => {
    setBusy(true)
    const ok = await onSave(key)
    setBusy(false)
    if (ok) {
      setDraft("")
      setEditing(false)
    }
  }

  return (
    <Row
      title={MEDIA_PROVIDER_LABELS[provider]}
      description={MEDIA_PROVIDER_ABOUT[provider]}
    >
      {saved && !editing ? (
        <div className="flex items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">Key saved</span>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || disabled}
            onClick={() => setEditing(true)}
          >
            Replace
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            className="hover:text-destructive"
            onClick={() => void submit(null)}
          >
            Remove
          </Button>
        </div>
      ) : (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            if (draft.trim()) void submit(draft)
          }}
        >
          <Input
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="API key"
            aria-label={`${MEDIA_PROVIDER_LABELS[provider]} API key`}
            value={draft}
            disabled={busy || disabled}
            onChange={(event) => setDraft(event.target.value)}
            className="h-7 w-52 font-mono text-xs"
          />
          <Button
            size="sm"
            type="submit"
            disabled={busy || disabled || !draft.trim()}
          >
            Save
          </Button>
          {editing && (
            <Button
              size="sm"
              variant="ghost"
              type="button"
              disabled={busy}
              onClick={() => {
                setDraft("")
                setEditing(false)
              }}
            >
              Cancel
            </Button>
          )}
        </form>
      )}
    </Row>
  )
}

/**
 * Off for now: the install buttons are hidden rather than deleted, so the
 * install path in the store and main still compiles and tests the same.
 */
const SHOW_PLUGIN_INSTALL = false

/**
 * The plugins: the built-in ones, then the ones installed from a folder or a
 * `.zip` — the way in for a plugin made outside the app until there is a
 * marketplace, which will install through the same `installPlugin`.
 *
 * The warning is standing rather than a confirm on the first switch: it is
 * true of every plugin every time, and a dialog clicked through once says
 * nothing to whoever switches on the next one. An installed plugin arrives
 * **off** for the same reason — picking a folder is not the decision to run it.
 */
function PluginsSection() {
  const plugins = usePlugins((state) => state.plugins)
  const enabled = usePlugins((state) => state.enabled)
  const disabled = usePlugins((state) => state.disabled)
  const status = usePlugins((state) => state.status)
  const refresh = usePlugins((state) => state.refresh)
  const setEnabled = usePlugins((state) => state.setEnabled)
  const reload = usePlugins((state) => state.reload)
  const install = usePlugins((state) => state.install)
  const remove = usePlugins((state) => state.remove)
  /** What the last install said: which plugin, or why not. */
  const [outcome, setOutcome] = useState<{
    text: string
    failed: boolean
  } | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    void refresh()
  }, [refresh])

  const installFrom = async (source: "folder" | "zip") => {
    setInstalling(true)
    try {
      const installed = await install(source)
      if (installed) {
        setOutcome({
          text: installed.replaced
            ? `Updated ${installed.name}.`
            : `Installed ${installed.name}. Switch it on to run it.`,
          failed: false,
        })
      }
    } catch (error) {
      setOutcome({ text: messageOfError(error), failed: true })
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs leading-relaxed">
        A plugin runs inside the studio with the same access the studio has —
        your files, your terminals, your chats. Built-in plugins come with the
        app; switch on others only if you wrote or trust them.
      </p>

      {SHOW_PLUGIN_INSTALL && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={installing}
              onClick={() => void installFrom("folder")}
            >
              <FolderOpen className="size-3.5" />
              Install from folder…
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={installing}
              onClick={() => void installFrom("zip")}
            >
              <FileArchive className="size-3.5" />
              Install from .zip…
            </Button>
          </div>
          {/* `polite` so a screen reader hears how the install went, which is
            otherwise a dialog closing and nothing else. */}
          <p
            aria-live="polite"
            className={cn(
              "text-xs",
              outcome?.failed ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {outcome?.text ??
              "A plugin is a folder with a manifest.json and a main.js. Installing the same id again updates it."}
          </p>
        </div>
      )}

      {plugins.length === 0 ? null : (
        <Card>
          {plugins.map((plugin) => {
            const on = isOn(plugin, { enabled, disabled })
            const state = status[plugin.id]
            const problem = plugin.error ?? failureOf(state)
            return (
              <Row
                key={plugin.id}
                title={
                  <span className="inline-flex items-center gap-1.5">
                    {plugin.manifest
                      ? `${plugin.manifest.name} ${plugin.manifest.version}`
                      : plugin.id}
                    {plugin.bundled && <OfficialBadge />}
                  </span>
                }
                description={
                  problem ? (
                    <span className="text-destructive">{problem}</span>
                  ) : (
                    (plugin.manifest?.description ?? plugin.id)
                  )
                }
              >
                <div className="flex items-center gap-1">
                  {on && (
                    <IconButton
                      label="Reload"
                      onClick={() => void reload(plugin.id)}
                    >
                      <RefreshCw className="size-3.5" />
                    </IconButton>
                  )}
                  {/* A built-in plugin is switched off, never removed: it is
                      part of the app, and the next update would bring it back. */}
                  {!plugin.bundled && (
                    <IconButton
                      label="Remove"
                      className="hover:text-destructive"
                      onClick={() =>
                        void remove(plugin.id).catch((error: unknown) =>
                          setOutcome({
                            text: messageOfError(error),
                            failed: true,
                          })
                        )
                      }
                    >
                      <Trash2 className="size-3.5" />
                    </IconButton>
                  )}
                  <Switch
                    checked={on}
                    disabled={
                      (!on && plugin.error !== null) ||
                      state?.state === "loading"
                    }
                    onCheckedChange={(next) => void setEnabled(plugin.id, next)}
                  />
                </div>
              </Row>
            )
          })}
        </Card>
      )}
    </div>
  )
}

function failureOf(status: PluginStatus | undefined): string | null {
  return status?.state === "failed" ? status.error : null
}

/** What crossed the bridge as an error, without Electron's `Error invoking
 * remote method '…':` in front of the sentence main wrote. */
function messageOfError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "")
}

/**
 * Which build this is, and the button that replaces it.
 *
 * The same store the status bar's pill reads, and the same install — this page
 * exists because a pill that only appears when there is news cannot answer
 * "am I up to date?", and because somebody who skipped a version needs
 * somewhere to change their mind. So the dismissal is deliberately ignored
 * here: a section headed Updates is not a place to hide one.
 *
 * There is no "check automatically" switch. The check is one request every six
 * hours against a public endpoint, carrying nothing about the user — a
 * preference for that is a decision nobody has enough information to make, and
 * every setting costs a line somebody has to read.
 */
function UpdatesSection() {
  const check = useUpdates((state) => state.check)
  const checking = useUpdates((state) => state.checking)
  const installing = useUpdates((state) => state.installing)
  const progress = useUpdates((state) => state.progress)
  const error = useUpdates((state) => state.error)
  const refresh = useUpdates((state) => state.refresh)
  const install = useUpdates((state) => state.install)
  // Dismissal is the pill's business, not this page's.
  const update = useUpdates((state) => pendingUpdate(state, false))
  const [versions, setVersions] = useState<ClaudeVersions | null>(null)

  const askVersions = () =>
    void window.desktop.claudeVersions().then(setVersions)
  // Asked on open rather than at launch: the CLI updates itself, so the answer
  // is worth having only when somebody is looking at it.
  useEffect(askVersions, [])

  return (
    <Card>
      <Row
        title="Version"
        description={
          !check
            ? "Checking…"
            : check.status === "current"
              ? `Vey Studio ${check.current} — the latest release.`
              : `Vey Studio ${check.current}.`
        }
      >
        <Button
          variant="outline"
          size="sm"
          disabled={checking}
          onClick={() => {
            askVersions()
            void refresh()
          }}
        >
          <RefreshCw className={cn("size-3.5", checking && "animate-spin")} />
          Check now
        </Button>
      </Row>

      <Row
        title="Claude Code"
        description={
          !versions
            ? "Checking…"
            : `CLI ${versions.cli ?? "not found"} · Agent SDK ${versions.sdk}${
                versions.error ? ` — ${versions.error}` : ""
              }`
        }
      />

      {update ? (
        <Row
          title={`Vey Studio ${update.version} is available`}
          description={
            installing ? (
              // The bar takes the description's place rather than sitting under
              // the button: it is what this row is about while it is on screen,
              // and the sentence it replaces is one the user has just acted on.
              <span className="mt-1.5 block max-w-xs">
                <UpdateProgressBar progress={progress} />
              </span>
            ) : update.installable ? (
              "Restarts the app; terminal sessions end."
            ) : (
              "In-app install is macOS and Windows only."
            )
          }
        >
          <div className="flex items-center gap-2">
            <a
              href={update.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              What&rsquo;s new
              <ExternalLink className="size-3" />
            </a>
            {update.installable && (
              <Button
                size="sm"
                disabled={installing}
                onClick={() => void install()}
              >
                {installLabel(installing, progress)}
              </Button>
            )}
          </div>
        </Row>
      ) : (
        check?.status === "unknown" && (
          // Said out loud rather than left as silence: "no update" and "could
          // not ask" look identical otherwise, and only one of them means the
          // version on screen is worth trusting.
          <Row title="Could not check" description={check.error}>
            <a
              href="https://github.com/veystudioapp/vey-studio-releases/releases"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Releases
              <ExternalLink className="size-3" />
            </a>
          </Row>
        )
      )}

      {error && (
        <p className="px-4 pb-3 text-xs leading-relaxed text-destructive">
          {error} The installer&rsquo;s own output is in{" "}
          <code className="font-mono">~/.veystudio/update.log</code>.
        </p>
      )}
    </Card>
  )
}

/** The box a section's rows sit in — one border around the group rather than
 * one per row, so a section of three reads as three rows of one thing. */
function Card({ children }: { children: ReactNode }) {
  return <div className="divide-y rounded-lg border">{children}</div>
}

/** One setting: what it is, what it does, and the control at the end of the
 * line. There was a `stacked` variant for a control too big for that — the tab
 * strip's two placement pictures — and it went with them. */
function Row({
  title,
  description,
  children,
}: {
  /** A name, all but always — `ReactNode` because a plugin's carries the
   * official badge beside it. */
  title: ReactNode
  /** A sentence, all but always — `ReactNode` because the update row swaps its
   * own for a progress bar while an install runs. */
  description: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex gap-6 p-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm leading-none font-medium">{title}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  )
}

/** A handful of exclusive choices, short enough to show all at once. */
function Segmented({
  value,
  options,
  onPick,
}: {
  value: string
  options: { value: string; label: string }[]
  onPick: (value: string) => void
}) {
  return (
    <div role="radiogroup" className="flex rounded-md border bg-muted/40 p-0.5">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onPick(option.value)}
            className={cn(
              "rounded-[5px] px-2.5 py-1 text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active
                ? "bg-background font-medium text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
