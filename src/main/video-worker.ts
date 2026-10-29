/**
 * The render worker — `VideoEngine`'s child process, the Electron binary
 * running as plain Node with its job in `VEYSTUDIO_VIDEO_JOB`.
 *
 * Its own esbuild entry (`scripts/build-electron.mjs`), like the daemon, and
 * deliberately importing nothing of Remotion's at build time: the packages are
 * the ones `VideoEngine.install` put in the engine folder, required from there
 * at run time, so the app bundle carries none of them.
 *
 * Says how it is going as one JSON object per stdout line (`WorkerMessage`)
 * and ends on a `done` or an `error`.
 */
import { rename, rm } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"

import {
  COMPOSITION_ID,
  VIDEO_IMPORTS,
  VIDEO_OUTPUT,
  type VideoProgress,
  type WorkerMessage,
} from "../shared/video"

type Job =
  | { task: "browser"; engine: string }
  | { task: "render"; engine: string; video: string }

/** The slice of Remotion's API this calls — typed here because the packages
 * are not installed where this is compiled. */
type Renderer = {
  ensureBrowser: (options: {
    onBrowserDownload?: () => {
      version: string | null
      onProgress: (progress: { percent: number }) => void
    }
  }) => Promise<unknown>
  selectComposition: (options: {
    serveUrl: string
    id: string
    inputProps: Record<string, unknown>
  }) => Promise<{ durationInFrames: number }>
  renderMedia: (options: {
    composition: unknown
    serveUrl: string
    codec: "h264"
    outputLocation: string
    inputProps: Record<string, unknown>
    onProgress: (progress: {
      progress: number
      renderedFrames: number
      encodedFrames: number
    }) => void
  }) => Promise<unknown>
}

type WebpackConfig = {
  resolve?: { alias?: Record<string, string> | unknown[] } & Record<
    string,
    unknown
  >
} & Record<string, unknown>

type Bundler = {
  bundle: (options: {
    entryPoint: string
    rootDir?: string
    publicDir?: string
    onProgress?: (percent: number) => void
    webpackOverride?: (config: WebpackConfig) => WebpackConfig
  }) => Promise<string>
}

function say(message: WorkerMessage): void {
  process.stdout.write(`${JSON.stringify(message)}\n`)
}

/** Progress, said only when it has moved a whole percent — a render reports
 * every frame, and a line per frame is IPC traffic the bar cannot draw. */
function progressSayer(): (progress: VideoProgress) => void {
  let last = ""
  return (progress) => {
    const key = `${progress.stage}:${Math.floor((progress.progress ?? 0) * 100)}`
    if (key === last) return
    last = key
    say({ type: "progress", progress })
  }
}

async function main(): Promise<void> {
  const job = JSON.parse(process.env.VEYSTUDIO_VIDEO_JOB ?? "null") as Job
  const engineRequire = createRequire(path.join(job.engine, "package.json"))
  const renderer = engineRequire("@remotion/renderer") as Renderer
  const report = progressSayer()

  await renderer.ensureBrowser({
    onBrowserDownload: () => ({
      version: null,
      onProgress: ({ percent }) =>
        report({
          dir: null,
          stage: "browser",
          // A fraction in the releases this was written against; a
          // percentage is read as one too rather than drawn at 4000%.
          progress: percent > 1 ? percent / 100 : percent,
        }),
    }),
  })
  if (job.task === "browser") {
    say({ type: "done", output: "" })
    return
  }

  const dir = job.video
  const bundler = engineRequire("@remotion/bundler") as Bundler
  // Every package the composition may import, pinned to the engine's copy.
  // Without it a project with its own `react` in `node_modules` — any React
  // app — hands the composition that one and Remotion the engine's: two
  // Reacts, and the first hook throws.
  const alias = Object.fromEntries(
    [...VIDEO_IMPORTS, "react-dom"].map((name) => [
      name,
      path.dirname(engineRequire.resolve(`${name}/package.json`)),
    ])
  )
  const serveUrl = await bundler.bundle({
    entryPoint: path.join(dir, "src", "index.ts"),
    // The root is the engine's, so webpack's cache lands there rather than in
    // whatever directory this was started in — which would also make the
    // engine's `public/` the one `staticFile` reads; the video's own is.
    rootDir: job.engine,
    publicDir: path.join(dir, "public"),
    onProgress: (percent) =>
      report({ dir, stage: "bundling", progress: percent / 100 }),
    webpackOverride: (config) => ({
      ...config,
      resolve: {
        ...config.resolve,
        alias: {
          ...(Array.isArray(config.resolve?.alias)
            ? {}
            : config.resolve?.alias),
          ...alias,
        },
      },
    }),
  })

  const composition = await renderer.selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps: {},
  })

  // Written beside the real one and moved over it at the end, so the player
  // never opens half a file and the last good render survives a failed one.
  const output = path.join(dir, VIDEO_OUTPUT)
  const partial = output.replace(/\.mp4$/, ".rendering.mp4")
  try {
    await renderer.renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: partial,
      inputProps: {},
      onProgress: ({ progress, renderedFrames }) =>
        report({
          dir,
          stage:
            renderedFrames < composition.durationInFrames
              ? "rendering"
              : "encoding",
          progress,
          frames: { done: renderedFrames, total: composition.durationInFrames },
        }),
    })
    await rename(partial, output)
  } catch (error) {
    await rm(partial, { force: true })
    throw error
  }
  say({ type: "done", output })
}

function fail(error: unknown): never {
  say({
    type: "error",
    message: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
}

// Not every failure comes back through `main`'s promise: Remotion's browser
// download rejects a promise nothing awaits, so a machine offline died with a
// raw stack on stderr instead of the one line the dialog can show.
process.on("unhandledRejection", fail)
process.on("uncaughtException", fail)

main().then(() => process.exit(0), fail)
