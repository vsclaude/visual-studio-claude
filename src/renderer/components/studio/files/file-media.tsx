import { useState } from "react"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { CircleSlash } from "lucide-react"

import { mediaFileUrl, mediaKindOf } from "@shared/media"
import { SECTION_ACCENT } from "../section-marks"

/**
 * An audio or video file, played.
 *
 * Streamed through `vsc-media://` rather than read into the store like a
 * picture — see `MEDIA_FILE_SCHEME` — so a long recording opens as fast as a
 * short one and seeking asks for the bytes it needs.
 *
 * Not reloaded when the checkout's git status moves, unlike the editors: that
 * signal moves whenever *any* file does, and a player restarted from zero
 * because a turn edited some other file is worse than one that never notices a
 * take replaced under the same name — which the `media` server never does,
 * since it writes a new file rather than over an old one (`writeMedia`).
 */
export function FileMedia({ path }: { path: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  const kind = mediaKindOf(path)
  const src = mediaFileUrl(path)

  if (failed) {
    return (
      <Empty className="size-full border-0">
        <EmptyHeader>
          <EmptyMedia variant="icon" style={{ color: SECTION_ACCENT.files }}>
            <CircleSlash />
          </EmptyMedia>
          <EmptyTitle>Could not play this file</EmptyTitle>
          <EmptyDescription>{failed}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex size-full items-center justify-center p-6">
      {kind === "video" ? (
        <video
          src={src}
          controls
          className="max-h-full max-w-full rounded-sm bg-black shadow-sm"
          onError={(event) => setFailed(errorOf(event.currentTarget))}
        />
      ) : (
        <audio
          src={src}
          controls
          className="w-full max-w-xl"
          onError={(event) => setFailed(errorOf(event.currentTarget))}
        />
      )}
    </div>
  )
}

/** The player's own reason, in words. A codec Chromium does not ship — HEVC
 * in a `.mov`, say — is the common one, and Reveal is the way out of it. */
function errorOf(element: HTMLMediaElement): string {
  const code = element.error?.code
  if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
    return "The studio cannot decode this format, or the file is gone. Reveal it to open it in a player that can."
  }
  if (code === MediaError.MEDIA_ERR_DECODE) {
    return "The file is damaged or only partly written."
  }
  return element.error?.message || "The file could not be read."
}
