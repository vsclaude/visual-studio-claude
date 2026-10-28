import { create } from "zustand"

/**
 * Whether this build has the studio's own server at all — what the Pro
 * dialog's buy buttons and its key field need (`shared/studio-server.ts`).
 * There is no sign-in to wait on any more: a build with a server can buy.
 */
type StudioServerState = {
  /** This build has a server at all. Asked once. */
  available: boolean
}

export const useStudioServer = create<StudioServerState>()(() => ({
  available: false,
}))

let asked = false

/** Asks main once whether there is a server. Idempotent. */
export function watchStudioServer(): void {
  if (asked) return
  asked = true
  void window.desktop
    .studioServerAvailable()
    .then((available) => useStudioServer.setState({ available }))
    .catch((error: unknown) => {
      console.error("Could not ask whether there is a studio server", error)
    })
}
