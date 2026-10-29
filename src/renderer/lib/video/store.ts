import { create } from "zustand"

import {
  firstVideoMessage,
  needsRender,
  renderFailedMessage,
  type Video,
  type VideoEngineStatus,
  type VideoProgress,
} from "@shared/video"

import { useChats } from "@/lib/chat/store"

/**
 * Videos made in a chat, on the renderer's side: the list, the engine, and
 * the renders. `docs/design.md` § Videos from a prompt.
 *
 * **A chat writes a video, this app renders it.** `/video <idea>` in a chat
 * (`start`) scaffolds `~/.veystudio/videos/<uuid>/` for its project and sends
 * the idea; from
 * then on the video belongs to that chat (`Video.chatId`), and whenever the
 * chat goes quiet with the code newer than the render (`needsRender`) it is
 * rendered again. So a change is just the next message in the chat — there is
 * nothing to press. The chat's own column (`chat/chat-video.tsx`) draws it.
 *
 * Renders and failures are in memory, like `sending`: a turn that ends while
 * the app is shut is a video rendered by the column's button.
 */
export type VideoJob =
  | { phase: "rendering"; progress: VideoProgress | null }
  | { phase: "failed"; error: string }

type VideoState = {
  engine: VideoEngineStatus | null
  /** The engine install running, with the last word from it. */
  installing: { progress: VideoProgress | null } | null
  installError: string | null
  videos: Video[]
  loaded: boolean
  /** By `Video.dir`. A video with no entry is idle. */
  jobs: Record<string, VideoJob>

  refresh: () => Promise<void>
  install: () => Promise<boolean>
  /** `/video <idea>` in a chat. Answers with an error to show, or null. */
  start: (chatId: string, idea: string) => Promise<string | null>
  render: (dir: string) => Promise<void>
  cancel: (dir: string) => void
  /** Hands a failed render's error to the video's chat, to fix — the render
   * follows when it answers, like any other change. */
  sendFailure: (dir: string) => Promise<void>
  remove: (dir: string) => Promise<void>
  /** Subscribes to progress and to chats going quiet. Called once. */
  listen: () => () => void
}

export const useVideos = create<VideoState>((set, get) => {
  function setJob(dir: string, job: VideoJob | null) {
    const jobs = { ...get().jobs }
    if (job) jobs[dir] = job
    else delete jobs[dir]
    set({ jobs })
  }

  /** A chat has gone quiet: render whichever of its videos it has changed. */
  async function afterTurn(chatId: string): Promise<void> {
    if (!get().videos.some((video) => video.chatId === chatId)) return
    await get().refresh()
    for (const video of get().videos) {
      if (video.chatId !== chatId || !needsRender(video)) continue
      if (get().jobs[video.dir]?.phase === "rendering") continue
      void get().render(video.dir)
    }
  }

  return {
    engine: null,
    installing: null,
    installError: null,
    videos: [],
    loaded: false,
    jobs: {},

    async refresh() {
      const [engine, videos] = await Promise.all([
        window.desktop.videoEngineStatus(),
        window.desktop.listVideos(),
      ])
      set({ engine, videos, loaded: true })
    },

    async install() {
      if (get().engine?.state === "installed") return true
      set({ installing: { progress: null }, installError: null })
      try {
        await window.desktop.installVideoEngine()
        set({
          installing: null,
          engine: await window.desktop.videoEngineStatus(),
        })
        return true
      } catch (error) {
        set({ installing: null, installError: messageOf(error) })
        return false
      }
    },

    async start(chatId, idea) {
      if (!idea.trim()) return null
      const chat = useChats
        .getState()
        .chats.find((entry) => entry.id === chatId)
      if (!chat?.folderId) return "This chat is not in a project."

      let video: Video
      try {
        // The format and length are only the scaffold's starting point: the
        // message tells the chat to size the video to what the idea says.
        video = await window.desktop.createVideo(chat.folderId, {
          prompt: idea,
          format: "portrait",
          seconds: 10,
        })
        await window.desktop.setVideoChat(video.dir, chatId)
      } catch (error) {
        return messageOf(error)
      }
      set({ videos: [{ ...video, chatId }, ...get().videos] })
      // The bubble says what was typed; the CLI gets the idea with the rules.
      await useChats
        .getState()
        .send(
          chatId,
          firstVideoMessage(video.dir, video),
          [],
          `/video ${idea.trim()}`
        )
      // Fetched while the chat writes, so the first render does not start
      // with a download.
      if (get().engine?.state !== "installed") void get().install()
      return null
    },

    async render(dir) {
      setJob(dir, { phase: "rendering", progress: null })
      if (!(await get().install())) {
        setJob(dir, {
          phase: "failed",
          error: get().installError ?? "The video engine is not installed.",
        })
        return
      }
      try {
        await window.desktop.renderVideo(dir)
        setJob(dir, null)
        await get().refresh()
      } catch (error) {
        setJob(dir, { phase: "failed", error: messageOf(error) })
      }
    },

    cancel(dir) {
      void window.desktop.cancelVideoRender(dir)
    },

    async sendFailure(dir) {
      const video = get().videos.find((entry) => entry.dir === dir)
      const job = get().jobs[dir]
      if (!video?.chatId || job?.phase !== "failed") return
      setJob(dir, null)
      await useChats
        .getState()
        .send(video.chatId, renderFailedMessage(video.dir, job.error))
    },

    async remove(dir) {
      await window.desktop.removeVideo(dir)
      setJob(dir, null)
      set({ videos: get().videos.filter((video) => video.dir !== dir) })
    },

    listen() {
      void get().refresh()

      const offProgress = window.desktop.onVideoProgress((progress) => {
        if (progress.dir === null) {
          if (get().installing) set({ installing: { progress } })
          return
        }
        if (get().jobs[progress.dir]?.phase === "rendering") {
          setJob(progress.dir, { phase: "rendering", progress })
        }
      })

      // The hand-off: a chat has stopped working.
      const offChats = useChats.subscribe((state, previous) => {
        for (const chatId of previous.sending) {
          if (!state.sending.includes(chatId)) void afterTurn(chatId)
        }
      })

      return () => {
        offProgress()
        offChats()
      }
    },
  }
})

function messageOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  // What `ipcRenderer.invoke` wraps a handler's throw in, which says nothing
  // the message after it does not.
  return message.replace(
    /^Error invoking remote method '[^']+': (Error: )?/,
    ""
  )
}
