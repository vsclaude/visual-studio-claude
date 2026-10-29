import { spawn, type ChildProcess } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import {
  ENGINE_PACKAGES,
  ENGINE_VERSION,
  workerMessageOf,
  type VideoEngineStatus,
  type VideoProgress,
} from "../shared/video"
import { locate, spawnEnvironment } from "./shell-env"

/**
 * Remotion, installed on demand and run out of process.
 *
 * **Not in the bundle.** The renderer drives a headless Chrome and ffmpeg —
 * about 300MB on disk (200MB of packages, the rest the browser) — for a
 * feature most installs never open. So the first video asks for it: the
 * packages go into `workspace/video-engine/` with the user's own `npm`, and the
 * browser is fetched by Remotion's own `ensureBrowser`, both with progress on
 * screen.
 *
 * **Not in this process.** Bundling a composition is webpack and rendering is
 * minutes of work; either in main would stall every IPC call behind it. A
 * render is `video-worker.ts`, the Electron binary running as plain Node (the
 * daemon's trick), talking newline-delimited JSON on stdout.
 *
 * Free of `electron`: the paths are arguments.
 */
export class VideoEngine {
  private installing: Promise<void> | null = null
  /** Running renders, by video folder — one each; a second asks for the same. */
  private readonly renders = new Map<
    string,
    { child: ChildProcess; done: Promise<string> }
  >()

  constructor(
    private readonly options: {
      /** `workspace/video-engine`. */
      dir: string
      /** The bundled `video-worker.cjs`. */
      worker: string
      /** What runs the worker — `process.execPath`, as Node. */
      node: string
    }
  ) {}

  async status(): Promise<VideoEngineStatus> {
    // Every package at its pinned version. An engine of another version is one
    // the chat was not told about, and one installed before a package joined
    // the list lacks an import the chat was told it has: either is installed
    // again (npm adds what is missing) rather than half-trusted.
    for (const [name, version] of Object.entries(ENGINE_PACKAGES)) {
      try {
        const manifest = JSON.parse(
          await readFile(
            path.join(this.options.dir, "node_modules", name, "package.json"),
            "utf8"
          )
        ) as { version?: unknown }
        if (manifest.version !== version) return { state: "missing" }
      } catch {
        return { state: "missing" }
      }
    }
    return { state: "installed", version: ENGINE_VERSION }
  }

  /** Installs the packages and the browser. One at a time: a second click
   * waits on the first rather than running npm twice into one folder. */
  install(onProgress: (progress: VideoProgress) => void): Promise<void> {
    this.installing ??= this.runInstall(onProgress).finally(() => {
      this.installing = null
    })
    return this.installing
  }

  private async runInstall(
    onProgress: (progress: VideoProgress) => void
  ): Promise<void> {
    const { dir } = this.options
    await mkdir(dir, { recursive: true })
    await writeFile(
      path.join(dir, "package.json"),
      `${JSON.stringify(
        {
          name: "veystudio-video-engine",
          private: true,
          dependencies: ENGINE_PACKAGES,
        },
        null,
        2
      )}\n`
    )

    // The user's own npm, found through their login shell like `claude` is:
    // a GUI app's PATH has none of Homebrew, nvm or asdf on it.
    const npm = await locate("npm")
    if (!npm) {
      throw new Error(
        "Making videos needs Node.js (for npm) to install its engine. Install Node.js from nodejs.org, then try again."
      )
    }
    onProgress({ dir: null, stage: "installing" })
    await runToEnd(
      npm,
      ["install", "--no-audit", "--no-fund", "--loglevel=error"],
      { cwd: dir, env: await spawnEnvironment() }
    )

    // The browser last: it is Remotion's own download, and only the installed
    // packages know which build of it they want.
    await new Promise<void>((resolve, reject) => {
      const child = this.spawnWorker({ task: "browser", engine: dir })
      readWorker(child, {
        progress: onProgress,
        done: () => resolve(),
        error: (message) => reject(new Error(message)),
      })
    })
  }

  /**
   * Renders `dir`'s composition to its `out/video.mp4`, answering with the
   * path. A render already running for that folder is the answer to this one
   * too — the button pressed twice is one render.
   */
  render(
    dir: string,
    onProgress: (progress: VideoProgress) => void
  ): Promise<string> {
    const running = this.renders.get(dir)
    if (running) return running.done

    const child = this.spawnWorker({
      task: "render",
      engine: this.options.dir,
      video: dir,
    })
    const done = new Promise<string>((resolve, reject) => {
      readWorker(child, {
        progress: (progress) => onProgress({ ...progress, dir }),
        done: resolve,
        error: (message) => reject(new Error(message)),
      })
    }).finally(() => {
      this.renders.delete(dir)
    })
    this.renders.set(dir, { child, done })
    return done
  }

  /** Stops a render; its promise rejects with "Stopped". */
  cancel(dir: string): void {
    this.renders.get(dir)?.child.kill()
  }

  /** Quit: a render left running would write a file nobody is waiting for. */
  killAll(): void {
    for (const { child } of this.renders.values()) child.kill()
  }

  private spawnWorker(job: Record<string, string>): ChildProcess {
    return spawn(this.options.node, [this.options.worker], {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        VEYSTUDIO_VIDEO_JOB: JSON.stringify(job),
      },
      windowsHide: true,
    })
  }
}

/** Feeds a worker's stdout to `on`, and turns an exit without a `done` into
 * an error carrying what it printed to stderr. */
function readWorker(
  child: ChildProcess,
  on: {
    progress: (progress: VideoProgress) => void
    done: (output: string) => void
    error: (message: string) => void
  }
): void {
  let settled = false
  let buffered = ""
  let stderr = ""

  child.stdout!.setEncoding("utf8")
  child.stdout!.on("data", (chunk: string) => {
    buffered += chunk
    const lines = buffered.split("\n")
    buffered = lines.pop() ?? ""
    for (const line of lines) {
      const message = workerMessageOf(line)
      if (!message) continue
      if (message.type === "progress") on.progress(message.progress)
      else if (!settled) {
        settled = true
        if (message.type === "done") on.done(message.output)
        else on.error(message.message)
      }
    }
  })
  child.stderr!.setEncoding("utf8")
  child.stderr!.on("data", (chunk: string) => {
    // The tail is what says why; a chatty bundler can print megabytes first.
    stderr = (stderr + chunk).slice(-8000)
  })
  child.on("error", (error) => {
    if (settled) return
    settled = true
    on.error(error.message)
  })
  child.on("exit", (code, signal) => {
    if (settled) return
    settled = true
    on.error(
      signal
        ? "Stopped."
        : stderr.trim() || `The video worker exited with code ${code}.`
    )
  })
}

/** Runs a command to completion, rejecting with its stderr. */
function runToEnd(
  file: string,
  args: string[],
  options: { cwd: string; env: Record<string, string | undefined> }
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, {
      ...options,
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true,
    })
    let stderr = ""
    child.stderr!.setEncoding("utf8")
    child.stderr!.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-8000)
    })
    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else
        reject(
          new Error(
            stderr.trim() || `${path.basename(file)} exited with code ${code}.`
          )
        )
    })
  })
}
