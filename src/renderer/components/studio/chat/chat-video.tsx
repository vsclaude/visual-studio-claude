import { useMemo, useState } from "react"
import {
  Clapperboard,
  ExternalLink,
  RotateCw,
  Square,
  Trash2,
  Wrench,
  X,
} from "lucide-react"

import { mediaFileUrl } from "@shared/media-files"
import type { Video } from "@shared/video"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useChats } from "@/lib/chat/store"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { useVideos, type VideoJob } from "@/lib/video/store"
import { IconButton } from "../icon-button"
import { SideColumn } from "./side-column"

/** Wide enough for a 16:9 player to be worth watching beside the transcript. */
const VIDEO_COLUMN_WIDTH = 420

/** The videos a chat has made with `/video`, newest first. Selected from the
 * whole list rather than by a filtering selector, which would be a new array on
 * every store change and a render loop. */
export function useChatVideos(chatId: string): Video[] {
  const videos = useVideos((state) => state.videos)
  return useMemo(
    () => videos.filter((video) => video.chatId === chatId),
    [videos, chatId]
  )
}

/**
 * A chat's video beside its transcript — what it is doing (the chat writing,
 * the render's progress, a failure to hand back) and the player once there is
 * something to play. Where the outline and the media go, one at a time.
 *
 * Nothing here asks for a change: that is the composer below, since the chat
 * that wrote the video is the one that changes it.
 */
export function ChatVideoColumn({
  chatId,
  onClose,
}: {
  chatId: string
  onClose: () => void
}) {
  const t = useT()
  const videos = useChatVideos(chatId)
  const [picked, setPicked] = useState<string | null>(null)
  const video =
    videos.find((entry) => entry.dir === picked) ?? videos[0] ?? null
  const job = useVideos((state) => (video ? state.jobs[video.dir] : undefined))
  const working = useChats((state) => state.sending.includes(chatId))

  return (
    <SideColumn label={t("video.label")} minWidth={VIDEO_COLUMN_WIDTH}>
      <div className="flex h-8 shrink-0 items-center gap-1 pr-1 pl-3">
        <Clapperboard className="size-3.5 shrink-0 text-muted-foreground" />
        {videos.length > 1 ? (
          <select
            aria-label={t("video.pick")}
            value={video?.dir ?? ""}
            onChange={(event) => setPicked(event.target.value)}
            className="min-w-0 flex-1 truncate bg-transparent text-[0.75rem] font-medium"
          >
            {videos.map((entry) => (
              <option key={entry.dir} value={entry.dir}>
                {entry.title}
              </option>
            ))}
          </select>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[0.75rem] font-medium">
            {video?.title}
          </span>
        )}
        <IconButton
          label={t("video.hide")}
          onClick={onClose}
          className="size-6"
        >
          <X className="size-3.5" />
        </IconButton>
      </div>

      <EngineBanner />

      {video && (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <Status video={video} job={job} working={working} />
          <Player video={video} />
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={working || job?.phase === "rendering"}
              onClick={() => void useVideos.getState().render(video.dir)}
            >
              <RotateCw />
              {video.output ? t("video.renderAgain") : t("video.render")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void window.desktop.revealPath(video.dir)}
            >
              <ExternalLink /> {t("video.reveal")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-destructive"
              onClick={() => {
                if (window.confirm(t("video.removeConfirm")))
                  void useVideos.getState().remove(video.dir)
              }}
            >
              <Trash2 /> {t("video.remove")}
            </Button>
          </div>
        </div>
      )}
    </SideColumn>
  )
}

/** One line over the player: the chat writing, the render, or its failure. */
function Status({
  video,
  job,
  working,
}: {
  video: Video
  job: VideoJob | undefined
  working: boolean
}) {
  const t = useT()

  if (job?.phase === "rendering") {
    const progress = job.progress
    const percent = percentOf(progress?.progress)
    const label =
      !progress || progress.stage === "browser"
        ? t("video.state.starting")
        : progress.stage === "bundling"
          ? t("video.state.bundling", { percent })
          : progress.stage === "encoding"
            ? t("video.state.encoding", { percent })
            : t("video.state.rendering", { percent })
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border p-2.5">
        <div className="flex items-center gap-2 text-xs">
          <Spinner className="size-3.5" />
          <span className="flex-1">{label}</span>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => useVideos.getState().cancel(video.dir)}
          >
            <Square /> {t("video.cancel")}
          </Button>
        </div>
        <Bar
          fraction={
            progress && progress.stage !== "browser"
              ? progress.progress
              : undefined
          }
        />
        {progress?.frames && (
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            {t("video.state.frames", {
              done: progress.frames.done,
              total: progress.frames.total,
            })}
          </span>
        )}
      </div>
    )
  }

  if (job?.phase === "failed") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2.5">
        <span className="text-xs font-medium text-destructive">
          {t("video.state.failed")}
        </span>
        <pre className="max-h-40 overflow-auto font-mono text-[0.65rem] whitespace-pre-wrap text-muted-foreground">
          {job.error}
        </pre>
        <div>
          <Button
            size="sm"
            disabled={working}
            onClick={() => void useVideos.getState().sendFailure(video.dir)}
          >
            <Wrench /> {t("video.sendFailure")}
          </Button>
        </div>
      </div>
    )
  }

  if (working) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-2.5 text-xs">
        <Spinner className="size-3.5" />
        {t("video.state.writing")}
      </div>
    )
  }

  return null
}

function Player({ video }: { video: Video }) {
  const t = useT()
  if (!video.output) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
        {t("video.state.notRendered")}
      </div>
    )
  }
  return (
    <div className="flex justify-center overflow-hidden rounded-lg bg-black">
      <video
        // A new render is a new URL, past Chromium's media cache.
        key={video.renderedAt}
        src={mediaFileUrl(video.output, video.renderedAt ?? 0)}
        controls
        className="max-h-[60vh] max-w-full"
      />
    </div>
  )
}

/** The engine, while it is missing or being fetched. */
function EngineBanner() {
  const t = useT()
  const engine = useVideos((state) => state.engine)
  const installing = useVideos((state) => state.installing)
  const installError = useVideos((state) => state.installError)

  if (installing) {
    const progress = installing.progress
    return (
      <div className="mx-3 flex flex-col gap-1.5 rounded-lg border px-2.5 py-2 text-xs">
        <span>
          {progress?.stage === "browser"
            ? t("video.engine.browser", {
                percent: percentOf(progress.progress),
              })
            : progress?.stage === "installing"
              ? t("video.engine.packages")
              : t("video.engine.installing")}
        </span>
        <Bar fraction={progress?.progress} />
      </div>
    )
  }

  if (engine?.state !== "missing") return null

  return (
    <div className="mx-3 flex flex-col gap-2 rounded-lg border px-2.5 py-2 text-xs">
      <p className="text-muted-foreground">
        {installError
          ? t("video.engine.failed", { error: installError })
          : t("video.engine.missing")}
      </p>
      <div>
        <Button size="sm" onClick={() => void useVideos.getState().install()}>
          {t("video.engine.install")}
        </Button>
      </div>
    </div>
  )
}

/** A fraction as a bar; no fraction is a bar that says only "working". */
function Bar({ fraction }: { fraction: number | undefined }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-border">
      <div
        className={cn(
          "h-full rounded-full bg-primary",
          fraction === undefined && "w-1/3 animate-pulse bg-primary/60"
        )}
        style={
          fraction === undefined
            ? undefined
            : { width: `${percentOf(fraction)}%` }
        }
      />
    </div>
  )
}

function percentOf(fraction: number | undefined): number {
  return Math.round(Math.min(1, Math.max(0, fraction ?? 0)) * 100)
}
