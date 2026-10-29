/**
 * Videos from a prompt: the pure half (`shared/video.ts`) and the folders
 * `main/videos.ts` writes, on a real temporary directory. The engine and the
 * worker are not run here — they need Remotion installed and a Chrome to
 * launch — see `docs/design.md` § Videos from a prompt.
 */
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import {
  createVideo,
  listVideos,
  restoreHelpers,
  setVideoChat,
} from "../src/main/videos"
import {
  COMPOSITION_ID,
  needsRender,
  firstVideoMessage,
  renderFailedMessage,
  scaffoldFiles,
  VIDEO_IMPORTS,
  videoTitle,
  workerMessageOf,
} from "../src/shared/video"
import { check, finish, section } from "./harness"

section("videoTitle")

check(
  "a short prompt is its own title",
  videoTitle("Logo reveal") === "Logo reveal"
)
check(
  "only the first line",
  videoTitle("Logo reveal\nthen the tagline") === "Logo reveal"
)
check(
  "a long one is cut at a word, with an ellipsis",
  videoTitle(
    "A ten second intro for our app where the logo flies in on a purple gradient"
  ) === "A ten second intro for our app where the logo…"
)

section("messages")

const first = firstVideoMessage("/data/videos/intro", {
  prompt: "  Logo flies in  ",
  format: "portrait",
  seconds: 8,
})
check(
  "the first message names the folder",
  first.includes("`/data/videos/intro/`")
)
check(
  "and the size to fall back on, when the idea names none",
  first.includes("1080×1920") && first.includes("whatever the idea asks for"),
  "there is no form any more: `/video a 5s reel` is how a size is asked for"
)
check("and carries the idea, trimmed", first.includes("\nLogo flies in\n"))
check(
  "and every import the chat may use",
  VIDEO_IMPORTS.every((name) => first.includes(`\`${name}\``))
)
check(
  "and tells it not to render",
  first.includes("Do not render"),
  "the studio renders — a chat that also does doubles the wait"
)
check(
  "and how to make a sound: computed, deterministic, through Html5Audio",
  first.includes("src/sound.ts") &&
    first.includes("<Html5Audio") &&
    first.includes("Math.random()"),
  "`Audio` is deprecated in the pinned Remotion; `Html5Audio` is its name now"
)
check(
  "and that a later change is asked in the same chat",
  first.includes("Later changes to this video are asked in this chat")
)
const long = "x".repeat(10_000) + "THE CAUSE"
const failed = renderFailedMessage("videos/intro", long)
check(
  "a failure keeps the tail, where the cause is",
  failed.includes("THE CAUSE") && failed.length < long.length
)
check(
  "and carries the rules again",
  failed.includes(COMPOSITION_ID),
  "a compacted chat may no longer have the first message"
)

section("needsRender")

check("never rendered", needsRender({ renderedAt: null, editedAt: 0 }))
check(
  "the code changed after the render",
  needsRender({ renderedAt: 100, editedAt: 200 })
)
check(
  "a chat that only talked leaves it alone",
  !needsRender({ renderedAt: 200, editedAt: 100 }),
  "a question about the video must not re-render it"
)

section("workerMessageOf")

check(
  "a progress line",
  workerMessageOf(
    '{"type":"progress","progress":{"dir":null,"stage":"browser"}}'
  )?.type === "progress"
)
check("noise is not a message", workerMessageOf("Bundling 6%") === null)
check("another shape is not either", workerMessageOf('{"type":"x"}') === null)

section("scaffoldFiles")

const files = scaffoldFiles({
  format: "square",
  seconds: 4,
  title: 'A "quoted" title',
})
check(
  "the composition is the one the studio renders",
  files["src/Root.tsx"]!.includes(`id="${COMPOSITION_ID}"`)
)
check(
  "at the format and length asked for",
  files["src/song.ts"]!.includes("bars: 2,") &&
    files["src/Root.tsx"]!.includes(
      "durationInFrames={SONG.durationInFrames}"
    ) &&
    files["src/Root.tsx"]!.includes("width={1080}") &&
    files["src/Root.tsx"]!.includes("height={1080}")
)
check(
  "the title is a JSX expression, so quotes in it are safe",
  files["src/Main.tsx"]!.includes('{"A \\"quoted\\" title"}')
)
check(
  "nothing for git: the folder is the app's, not a repository's",
  files[".gitignore"] === undefined
)

section("createVideo and listVideos")

const root = await mkdtemp(path.join(tmpdir(), "veystudio-video-"))
try {
  const one = await createVideo(root, "f1", {
    prompt: "Intro\nwith details",
    format: "landscape",
    seconds: 500,
  })
  check(
    "it lands in the videos folder, named by a UUID",
    path.dirname(one.dir) === root &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
        path.basename(one.dir)
      ),
    one.dir
  )
  check("and remembers its project", one.folderId === "f1")
  check("seconds are capped", one.seconds === 120)
  check("nothing is rendered yet", one.output === null)
  check(
    "the scaffold is written",
    (await readFile(path.join(one.dir, "src/index.ts"), "utf8")).includes(
      "registerRoot"
    )
  )

  // The scaffold's own sound helpers, imported and run as written to disk.
  const sound = (await import(path.join(one.dir, "src/sound.ts"))) as {
    SAMPLE_RATE: number
    wav: (samples: Float32Array) => string
    tone: (seconds: number, from: number, to?: number) => Float32Array
    noise: (seconds: number) => Float32Array
    mix: (
      seconds: number,
      parts: { at: number; samples: Float32Array }[]
    ) => Float32Array
  }
  const url = sound.wav(sound.tone(0.5, 880, 440))
  const bytes = Buffer.from(url.slice(url.indexOf(",") + 1), "base64")
  check(
    "a sound is a WAV data URL Remotion accepts",
    url.startsWith("data:audio/wav;base64,") &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WAVE",
    url.slice(0, 40)
  )
  check(
    "of the length asked for: 16-bit mono at the sample rate",
    bytes.length === 44 + Math.round(0.5 * sound.SAMPLE_RATE) * 2 &&
      bytes.readUInt32LE(24) === sound.SAMPLE_RATE &&
      bytes.readUInt16LE(22) === 1
  )
  check(
    "noise is the same every time it is computed",
    sound.wav(sound.noise(0.3)) === sound.wav(sound.noise(0.3)),
    "frames render in several tabs, and each must make the same sound"
  )
  check(
    "a tone stays in range",
    sound.tone(0.2, 440).every((sample) => Math.abs(sample) <= 1)
  )
  check(
    "mix places a sound at its time",
    sound
      .mix(1, [{ at: 0.5, samples: sound.tone(0.1, 440) }])
      .slice(0, sound.SAMPLE_RATE / 2)
      .every((sample) => sample === 0)
  )

  // The scaffold's music, the same way: composed, and in time. Only the
  // composing — the playing is Tone.js in a browser, which is not here.
  const { music } = (await import(path.join(one.dir, "src/music.ts"))) as {
    music: (options?: Record<string, unknown>) => {
      render: () => Promise<string>
      bpm: number
      beatFrames: number
      durationInFrames: number
      beat: (n: number) => number
      bar: (n: number) => number
      beatAt: (frame: number) => number
      pulse: (frame: number) => number
      kick: (frame: number) => number
      snare: (frame: number) => number
      crash: (frame: number) => number
      sections: { from: number; to: number; energy: string }[]
      sectionAt: (frame: number) => number
    }
  }
  const house = music({ style: "house", bpm: 120, bars: 4, intro: 1 })
  check(
    "a song is whole bars at its tempo",
    house.bpm === 120 &&
      house.beatFrames === 15 &&
      house.durationInFrames === 240 &&
      house.bar(1) === 60 &&
      house.beat(3) === 45 &&
      house.beatAt(50) === 3
  )
  /** Where the drums land, frame by frame — what the animation is cut to. */
  const drumsOf = (song: ReturnType<typeof music>) =>
    Array.from(
      { length: song.durationInFrames },
      (_, f) =>
        `${song.kick(f) > 0.9 ? "k" : ""}${song.snare(f) > 0.9 ? "s" : ""}`
    ).join(",")
  check(
    "the same options make the same song — every render tab agrees",
    drumsOf(music({ style: "house", bpm: 120, bars: 4, intro: 1 })) ===
      drumsOf(house)
  )
  check(
    "the kick lands on the beat after the intro, not before it",
    house.kick(house.bar(1)) > 0.95 &&
      house.kick(house.bar(1) + 7) < 0.4 &&
      house.kick(house.beat(2)) === 0 &&
      house.snare(house.beat(5)) > 0.95
  )
  check(
    "pulse is 1 on every beat",
    house.pulse(30) === 1 && house.pulse(37) < 0.2
  )
  const STYLES = [
    "house",
    "pop",
    "chill",
    "cinematic",
    "ambient",
    "trap",
    "synthwave",
    "funk",
    "dnb",
    "corporate",
  ]
  const songs = STYLES.map((style) =>
    music({ style, bars: 2, key: "F#", scale: "major" })
  )
  check(
    "every style makes a song, and ambient has no drums",
    songs.every(
      (song) => song.durationInFrames === Math.round(8 * song.beatFrames)
    ) &&
      songs[4]!.kick(0) === 0 &&
      songs[1]!.kick(0) > 0.95
  )
  check(
    "a seed is another song in the same style",
    new Set(
      [1, 2, 3, 4, 5, 6].map((seed) =>
        drumsOf(music({ style: "funk", bars: 2, seed }))
      )
    ).size > 1
  )
  const shaped = music({
    style: "synthwave",
    bpm: 100,
    sections: [
      { bars: 2, energy: "build" },
      { bars: 2, energy: "high" },
      { bars: 1, energy: "break" },
      { bars: 2, energy: "high" },
    ],
  })
  check(
    "sections are frames, in order, ending with the song",
    shaped.sections.map((section) => section.from).join() === "0,144,288,360" &&
      shaped.sections[3]!.to === shaped.durationInFrames &&
      shaped.sectionAt(150) === 1 &&
      shaped.sectionAt(10_000) === 3
  )
  check(
    "a build leads into a drop that opens with a crash and the kick",
    shaped.kick(30) === 0 && shaped.crash(144) > 0.95 && shaped.kick(144) > 0.95
  )
  check(
    "the break drops the drums",
    shaped.kick(300) < 0.05 && shaped.snare(300) < 0.05
  )

  const two = await createVideo(root, "f2", {
    prompt: "Intro",
    format: "portrait",
    seconds: 5,
  })
  check(
    "the same words twice are two folders",
    two.dir !== one.dir && two.title === one.title
  )

  await setVideoChat(one.dir, "chat-1")
  await mkdir(path.join(one.dir, "out"), { recursive: true })
  await writeFile(path.join(one.dir, "out/video.mp4"), "")

  // A folder without a record is not ours to list.
  await mkdir(path.join(root, "not-a-video"))

  const listed = await listVideos(root)
  check("both are listed, and nothing else", listed.length === 2, listed)
  const again = listed.find((video) => video.dir === one.dir)
  check("the chat is recorded", again?.chatId === "chat-1")
  check(
    "a render is found",
    again?.output === path.join(one.dir, "out/video.mp4")
  )
  check(
    "the newest source file is when it was last edited",
    (again?.editedAt ?? 0) > 0 && !needsRender(again!),
    "the render was written after the scaffold, so it is current"
  )
  // A turn that edits the code makes the render stale.
  const later = new Date(Date.now() + 60_000)
  await utimes(path.join(one.dir, "src/Main.tsx"), later, later)
  const edited = (await listVideos(root)).find((v) => v.dir === one.dir)!
  check("an edit after the render asks for another", needsRender(edited))
  check(
    "no videos folder yet lists nothing",
    (await listVideos(path.join(root, "nowhere"))).length === 0
  )
} finally {
  await rm(root, { recursive: true, force: true })
}

section("restoreHelpers")

// An older video, made before the helpers: they are written in, and a helper
// the chat has changed is left as it is.
const oldRoot = await mkdtemp(path.join(tmpdir(), "vsc-old-video-"))
try {
  const video = await createVideo(oldRoot, "folder", {
    prompt: "Old",
    format: "square",
    seconds: 5,
  })
  await rm(path.join(video.dir, "src/music.ts"))
  await writeFile(path.join(video.dir, "src/sound.ts"), "// mine\n")
  await restoreHelpers(video.dir)
  check(
    "a missing helper is restored, an edited one kept",
    (await readFile(path.join(video.dir, "src/music.ts"), "utf8")).includes(
      "export function music("
    ) &&
      (await readFile(path.join(video.dir, "src/sound.ts"), "utf8")) ===
        "// mine\n"
  )
} finally {
  await rm(oldRoot, { recursive: true, force: true })
}

finish()
