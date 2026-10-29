import { useEffect, useRef, useState } from "react"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { VideoOff } from "lucide-react"

import { mediaFileUrl } from "@shared/media-files"

import { useFiles } from "@/lib/files/store"
import { useT } from "@/lib/i18n"
import { SECTION_ACCENT } from "../section-marks"

/**
 * A file shown as a video — most often a render a chat has just written, so
 * somebody can watch it without leaving the studio for Finder.
 *
 * Streamed by `media-file://` rather than read into the store, and re-pointed
 * at a new URL whenever the file is rewritten (`videoRevisions`), so rendering
 * again and looking again is the whole loop.
 *
 * Paused when the pane goes out of sight: the panes are hidden rather than
 * unmounted, and a video playing in a hidden tab is sound from nowhere.
 */
export function FileVideo({
  path,
  visible,
}: {
  path: string
  visible: boolean
}) {
  const t = useT()
  const revision = useFiles((state) => state.videoRevisions[path] ?? 0)
  const video = useRef<HTMLVideoElement>(null)
  /** The revision that would not play, rather than a flag: a new revision is
   * a new file, which may play where the last one did not. */
  const [failedAt, setFailedAt] = useState<number | null>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null
  )

  useEffect(() => {
    if (!visible) video.current?.pause()
  }, [visible])

  if (failedAt === revision) {
    return (
      <Empty className="size-full border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon" style={{ color: SECTION_ACCENT.files }}>
            <VideoOff />
          </EmptyMedia>
          <EmptyTitle>{t("files.video.couldNotPlay")}</EmptyTitle>
          <EmptyDescription>
            {t("files.video.couldNotPlayDetail")}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <video
            ref={video}
            src={mediaFileUrl(path, revision)}
            controls
            onLoadedMetadata={(event) =>
              setSize({
                width: event.currentTarget.videoWidth,
                height: event.currentTarget.videoHeight,
              })
            }
            onError={() => setFailedAt(revision)}
            className="max-h-full max-w-full rounded-sm bg-black shadow-sm"
          />
        </div>
      </div>

      {size && (
        <p className="shrink-0 border-t px-3 py-1.5 text-center font-mono text-[0.65rem] text-muted-foreground">
          {size.width} × {size.height}
        </p>
      )}
    </div>
  )
}
