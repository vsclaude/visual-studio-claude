/**
 * Videos made from a prompt — the shapes both sides share, and the pure half of
 * the feature (`test/video.ts`).
 *
 * A video is a small Remotion project in a folder of the app's own,
 * `~/.veystudio/videos/<uuid>/`, written by the chat `/video` was typed in and
 * rendered by this app. The chat is the one that writes the animation because only a model
 * can turn "a 10 second intro, purple, the logo flies in" into code; the app is
 * the one that renders because only it can show a real progress bar and keep
 * the engine out of the project. `docs/design.md` § Videos from a prompt has the
 * argument, including why the chat is a visible one.
 */

/** The shapes a video is started at — the three a feed, a page and a square
 * post want. The chat may change the duration; the id of the composition it
 * renders (`COMPOSITION_ID`) is what stays put. */
export const VIDEO_FORMATS = {
  portrait: { width: 1080, height: 1920 },
  landscape: { width: 1920, height: 1080 },
  square: { width: 1080, height: 1080 },
} as const

export type VideoFormat = keyof typeof VIDEO_FORMATS

export const VIDEO_FPS = 30

/** The composition the studio renders, whatever else the chat registers. */
export const COMPOSITION_ID = "Main"

/** Where the videos live, under the app's data directory (`~/.veystudio`). */
export const VIDEOS_DIR = "videos"

/** What a render writes, relative to the video's own folder. */
export const VIDEO_OUTPUT = "out/video.mp4"

/** `videos/<uuid>/video.json` — what the studio knows about one video that the
 * code itself does not say. */
export type VideoRecord = {
  /** The project it was made in — whose chat writes it. */
  folderId: string
  title: string
  /** What was first asked for, kept to show on the card. */
  prompt: string
  format: VideoFormat
  seconds: number
  /** The chat writing it — the same one every change is asked of. */
  chatId: string | null
  createdAt: string
}

/** A video as the renderer lists it. **`dir` is its identity** — every call
 * about one names it by its folder, which main checks is one of
 * `~/.veystudio/videos/`'s with a record, like any other path the renderer
 * sends. */
export type Video = VideoRecord & {
  /** Absolute: the video's own folder, which is also what the chat is told. */
  dir: string
  /** Absolute, when a render has been written. */
  output: string | null
  /** The output's mtime, so a re-render is a new URL for the player. */
  renderedAt: number | null
  /** The newest file under `src/` — newer than `renderedAt` is a video
   * whose chat has changed it since, and is rendered again when that chat
   * goes quiet (`needsRender`). */
  editedAt: number
}

/** Whether a video's code is newer than its render, or it has none. */
export function needsRender(video: Pick<Video, "renderedAt" | "editedAt">) {
  return video.renderedAt === null || video.editedAt > video.renderedAt
}

export type VideoEngineStatus =
  { state: "missing" } | { state: "installed"; version: string }

/**
 * How far a render or an engine install has got, pushed while it runs.
 *
 * `progress` is 0–1 where the stage has a real one and absent where it does
 * not: npm says nothing about how far it is, and a bar ramped to look busy
 * would be the app making a number up.
 */
export type VideoProgress = {
  /** The video it is for, by `dir`, or null for the engine install. */
  dir: string | null
  stage: "installing" | "browser" | "bundling" | "rendering" | "encoding"
  progress?: number
  /** `rendering`'s frame count, for the line under the bar. */
  frames?: { done: number; total: number }
}

/** The engine's packages, pinned: what the chat is told it may import is
 * exactly what is installed, and an upgrade is a decision, not a drift. */
export const ENGINE_VERSION = "4.0.539"
export const ENGINE_PACKAGES: Record<string, string> = {
  remotion: ENGINE_VERSION,
  "@remotion/bundler": ENGINE_VERSION,
  "@remotion/renderer": ENGINE_VERSION,
  "@remotion/transitions": ENGINE_VERSION,
  "@remotion/shapes": ENGINE_VERSION,
  // What plays the composed music (`src/music.ts`): an offline Web Audio
  // render in the engine's own Chrome.
  tone: "15.1.22",
  react: "19.2.4",
  "react-dom": "19.2.4",
}

/** What the chat may import — the engine's packages a composition draws with. */
export const VIDEO_IMPORTS = [
  "remotion",
  "react",
  "@remotion/transitions",
  "@remotion/shapes",
  "tone",
]

/** One line of the render worker's stdout. */
export type WorkerMessage =
  | { type: "progress"; progress: VideoProgress }
  | { type: "done"; output: string }
  | { type: "error"; message: string }

export function workerMessageOf(line: string): WorkerMessage | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== "object") return null
  const message = parsed as { type?: unknown }
  if (
    message.type === "progress" ||
    message.type === "done" ||
    message.type === "error"
  )
    return parsed as WorkerMessage
  return null
}

/** A title off the prompt: its first line, cut at a word near 48 characters. */
export function videoTitle(prompt: string): string {
  const line = prompt.trim().split("\n")[0]!.trim()
  if (line.length <= 48) return line || "Video"
  const cut = line.slice(0, 48)
  const space = cut.lastIndexOf(" ")
  return `${(space > 24 ? cut.slice(0, space) : cut).trim()}…`
}

/** Inline code in a message, without a backslash per backtick. */
function code(text: string): string {
  return "`" + text + "`"
}

/** The rules every message about a video carries, since a chat that has been
 * compacted may no longer remember the first one. */
function rules(dir: string): string {
  return [
    `- Keep every file inside ${code(`${dir}/`)}. The animation is ${code(`${dir}/src/Main.tsx`)}; ${code(`${dir}/src/Root.tsx`)} registers it as the composition ${code(COMPOSITION_ID)} — set its ${code("width")}, ${code("height")} and ${code("durationInFrames")} to fit, but keep the id.`,
    `- Import only ${VIDEO_IMPORTS.map(code).join(", ")}. They are provided by the studio — do not install anything or add a package.json.`,
    "- Drive every movement off `useCurrentFrame()` with `interpolate`, `spring` or `Sequence`. No CSS animations or transitions: frames are rendered one at a time and those run on the wall clock.",
    "- No network: no web fonts, remote images or fetches. Inline styles; system fonts.",
    `- Sound only where the idea calls for it — a whoosh on an entrance, a ding on the reveal. Sound effects are computed too: ${code("src/sound.ts")} turns samples into a WAV data URL (${code("wav")}) and has ${code("tone")} and ${code("noise")} to start from. Compute each sound once at module level, never per frame, and keep it deterministic — no ${code("Math.random()")}: frames render in several tabs at once and each must make the same sound. Play it with ${code("<Html5Audio src={…} volume={…} />")} from ${code("remotion")}, placed in time by a ${code("<Sequence from={…}>")}. Short, simple effects only.`,
    `- Background music too, unless the idea asks for silence: ${code("src/music.ts")} composes it and Tone.js plays it — read its header. Pick the ${code("style")} that suits the idea (${code("house")}, ${code("pop")}, ${code("chill")}, ${code("cinematic")}, ${code("ambient")}, ${code("trap")}, ${code("synthwave")}, ${code("funk")}, ${code("dnb")}, ${code("corporate")}), a ${code("key")}, a ${code("bpm")}, and a ${code("seed")} — each seed is a different song, so do not leave it at 1 every time. Shape the song to the scenes with ${code("sections")}, each some bars at an energy (${code("low")}, ${code("mid")}, ${code("high")}, ${code("build")}, ${code("break")}): a ${code("build")} rises into the section after it, which is the place for the main reveal. The song is ${code("SONG")} in ${code("src/song.ts")}; ${code("Root.tsx")} already sets the length to ${code("SONG.durationInFrames")} (whole bars — choose the bars and ${code("bpm")} to land near the length asked for) and renders the audio once into ${code("Main")}'s ${code("music")} prop, which ${code("Main")} plays with ${code("<Html5Audio src={music} volume={0.8} />")}. Keep that wiring; never call ${code("SONG.render()")} in a component. The tempo is yours, so cut to it: never time things in seconds; change scenes on ${code("SONG.sections[i].from")} or ${code("SONG.bar(n)")}, accent on ${code("SONG.beat(n)")}, and make things punch or glow with ${code("SONG.kick(frame)")}, ${code("SONG.snare(frame)")}, ${code("SONG.crash(frame)")} or ${code("SONG.pulse(frame)")}, all 0–1. No recordings and no speech — say so if the idea asks for a voice.`,
    "- Do not render, start a preview or run the code — the studio renders it as soon as you finish and will tell you if it fails.",
  ].join("\n")
}

/** The first message of a video's chat. English like everything else sent to
 * `claude`; the idea is the user's own words, whatever language. */
export function firstVideoMessage(
  dir: string,
  record: Pick<VideoRecord, "prompt" | "format" | "seconds">
): string {
  const { width, height } = VIDEO_FORMATS[record.format]
  return [
    `Make a motion video with Remotion in ${code(`${dir}/`)} — the studio's own folder for videos, outside this project; it is already set up. The idea:`,
    "",
    record.prompt.trim(),
    "",
    // The size and length are the idea's to say ("a 5s reel"), so the scaffold's
    // are only where to start from — there is no form asking for them.
    `Size and length: whatever the idea asks for; if it says nothing, keep ${width}×${height} at ${VIDEO_FPS}fps and about ${record.seconds} seconds.`,
    rules(dir),
    // A change asked later is an ordinary message in this chat, and the studio
    // renders again whenever the code is newer than the last render.
    `- Later changes to this video are asked in this chat: edit the same files, and the studio renders again when you finish.`,
  ].join("\n")
}

/** A render that failed, handed back to the chat that wrote the code. */
export function renderFailedMessage(dir: string, error: string): string {
  // The tail: a webpack failure leads with pages of stack the model does not
  // need, and the cause is at the end.
  const tail = error.length > 4000 ? `…${error.slice(-4000)}` : error
  return [
    `The studio's render of ${code(`${dir}/`)} failed:`,
    "",
    "```",
    tail.trim(),
    "```",
    "",
    "Fix the code so it renders.",
    "",
    rules(dir),
  ].join("\n")
}

/** The files a new video starts as — enough to render a placeholder, so the
 * chat edits a working project rather than inventing the scaffolding. */
export function scaffoldFiles(
  record: Pick<VideoRecord, "format" | "seconds" | "title">
): Record<string, string> {
  const { width, height } = VIDEO_FORMATS[record.format]
  // The placeholder song at pop's tempo, as many bars as come nearest the
  // length asked for: the composition is as long as its song.
  const bars = Math.max(2, Math.round(record.seconds / (240 / 108)))
  return {
    "src/index.ts": `import { registerRoot } from "remotion"
import { Root } from "./Root"

registerRoot(Root)
`,
    "src/Root.tsx": `import { Composition } from "remotion"
import { Main } from "./Main"
import { SONG } from "./song"

export function Root() {
  return (
    <Composition
      id="${COMPOSITION_ID}"
      component={Main}
      durationInFrames={SONG.durationInFrames}
      fps={${VIDEO_FPS}}
      width={${width}}
      height={${height}}
      defaultProps={{ music: "" }}
      // The song is played once, here, and every frame gets it as a prop —
      // played in each render tab it would be several slightly different songs.
      calculateMetadata={async () => ({ props: { music: await SONG.render() } })}
    />
  )
}
`,
    "src/song.ts": `import { music } from "./music"

export const SONG = music({ style: "pop", bpm: 108, bars: ${bars}, intro: 1, seed: 1 })
`,
    "src/Main.tsx": `import { AbsoluteFill, Html5Audio, interpolate, useCurrentFrame } from "remotion"

export function Main({ music }: { music: string }) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  })
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        background: "#120f1d",
        color: "white",
        fontFamily: "system-ui, sans-serif",
        fontSize: 72,
        opacity,
      }}
    >
      {music ? <Html5Audio src={music} volume={0.8} /> : null}
      {${JSON.stringify(record.title)}}
    </AbsoluteFill>
  )
}
`,
    // Ready-made rather than left to the chat: a WAV header written from memory
    // is the one part of a sound effect that fails silently.
    "src/sound.ts": SOUND_TS,
    // The same for music: a sequencer from memory is a long way to an
    // in-tune bar, and the timing helpers are what keep the cut on the beat.
    "src/music.ts": MUSIC_TS,
    // A tsconfig of its own, so an editor opening the folder reads the JSX
    // as React's rather than complaining about every tag.
    "tsconfig.json": `${JSON.stringify(
      {
        compilerOptions: {
          jsx: "react-jsx",
          module: "ESNext",
          moduleResolution: "Bundler",
          target: "ES2022",
          strict: true,
          skipLibCheck: true,
        },
      },
      null,
      2
    )}\n`,
  }
}

/**
 * `src/sound.ts` in every new video: sound effects computed rather than
 * fetched, since a video has no audio files and no network. Deterministic —
 * Remotion renders in several tabs at once, and a sound that differed between
 * them would be several different assets — so the noise is a seeded generator
 * rather than `Math.random()`.
 */
const SOUND_TS = String.raw`/**
 * Sound made from numbers — there are no audio files here and no network.
 * Compute a sound once, at module level, and play it with
 *   <Sequence from={30}><Html5Audio src={WHOOSH} volume={0.6} /></Sequence>
 */
export const SAMPLE_RATE = 44100

/** Mono samples in [-1, 1] as a data:audio/wav URL for <Html5Audio src>. */
export function wav(samples: Float32Array, sampleRate = SAMPLE_RATE): string {
  const bytes = new Uint8Array(44 + samples.length * 2)
  const view = new DataView(bytes.buffer)
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i))
  }
  text(0, "RIFF")
  view.setUint32(4, 36 + samples.length * 2, true)
  text(8, "WAVE")
  text(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, "data")
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(44 + i * 2, Math.round(s * 0x7fff), true)
  }
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return "data:audio/wav;base64," + btoa(binary)
}

/** seconds of samples from f(t), t in seconds. */
export function synth(
  seconds: number,
  f: (t: number) => number,
  sampleRate = SAMPLE_RATE
): Float32Array {
  const out = new Float32Array(Math.max(1, Math.round(seconds * sampleRate)))
  for (let i = 0; i < out.length; i++) out[i] = f(i / sampleRate)
  return out
}

/** A tone gliding from "from" to "to" Hz, quick attack and exponential decay:
 * a blip, a ding, a rising sweep. */
export function tone(seconds: number, from: number, to = from, decay = 6): Float32Array {
  let phase = 0
  return synth(seconds, (t) => {
    phase += (2 * Math.PI * (from + (to - from) * (t / seconds))) / SAMPLE_RATE
    return Math.sin(phase) * Math.min(1, t * 200) * Math.exp(-decay * t)
  })
}

/** Seeded noise shaped by envelope(x), x from 0 to 1, through a one-pole
 * low-pass (0–1, lower is darker): a whoosh, a hit, a swell. */
export function noise(
  seconds: number,
  envelope: (x: number) => number = (x) => Math.sin(Math.PI * x),
  lowpass = 0.15,
  seed = 1
): Float32Array {
  let state = seed >>> 0 || 1
  let last = 0
  return synth(seconds, (t) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    const white = (state / 0xffffffff) * 2 - 1
    last += lowpass * (white - last)
    return Math.max(-1, Math.min(1, last * 3 * envelope(t / seconds)))
  })
}

/** Several sounds into one, each at a start time in seconds. */
export function mix(
  seconds: number,
  parts: { at: number; samples: Float32Array; gain?: number }[]
): Float32Array {
  const out = new Float32Array(Math.max(1, Math.round(seconds * SAMPLE_RATE)))
  for (const { at, samples, gain = 1 } of parts) {
    const start = Math.round(at * SAMPLE_RATE)
    for (let i = 0; i < samples.length && start + i < out.length; i++) {
      out[start + i] = (out[start + i] ?? 0) + (samples[i] ?? 0) * gain
    }
  }
  return out
}
`

/**
 * `src/music.ts` in every new video: background music composed in code and
 * played by Tone.js. The composing is this file's own — ten styles, each a
 * bank of grooves, bass lines, comps and sounds a seed picks from, a melody
 * of a motif and its answer, sections at an energy with fills and crashes —
 * and needs no audio, so the timing helpers the animation is cut to are
 * plain arithmetic in every tab. The playing is Tone's: its synths, filters,
 * chorus, reverb, echo and limiter in an offline context, once, from Root's
 * `calculateMetadata`, into a WAV data URL every frame gets as a prop
 * (`docs/design.md` § Videos from a prompt).
 */
const MUSIC_TS = String.raw`/**
 * Background music composed in code and played by Tone.js, in time with the
 * animation: the tempo and the shape are yours, so every beat and every
 * section is a frame you know. Describe the song once, in its own file:
 *
 *   // src/song.ts
 *   import { music } from "./music"
 *   export const SONG = music({
 *     style: "synthwave",
 *     bpm: 100,
 *     key: "E",
 *     scale: "minor",
 *     seed: 3,
 *     sections: [
 *       { bars: 2, energy: "build" },
 *       { bars: 4, energy: "high" },
 *       { bars: 2, energy: "break" },
 *       { bars: 4, energy: "high" },
 *     ],
 *   })
 *
 * Root.tsx already plays it once (calculateMetadata) and hands the audio to
 * Main as its "music" prop; Main plays it and cuts to it:
 *
 *   <Html5Audio src={music} volume={0.8} />
 *   <Sequence from={SONG.sections[1].from}>…</Sequence>   // on the drop
 *   <Sequence from={SONG.bar(2)}>…</Sequence>             // on the third bar
 *   const scale = 1 + 0.08 * SONG.kick(frame)              // punches with the kick
 *
 * Styles: house, pop, chill (lo-fi), cinematic, ambient, trap, synthwave,
 * funk (disco), dnb (drum and bass), corporate (bright and upbeat).
 *
 * Energies, one per section — shape them to the video's scenes:
 *   low    chords and light percussion, no kick or bass
 *   mid    the groove: drums, bass, chords, no melody
 *   high   everything, with the melody
 *   build  rising into the next section: a riser and a snare roll
 *   break  the drums drop out, the melody plays over the chords
 *
 * A seed is another song in the same style — other drum and bass patterns,
 * chords, sounds and melody.
 */

/** The rendered song's rate: one long data URL every render tab holds, and
 * little of a mix lives above 11 kHz. */
const RATE = 22050

export type Style =
  | "house"
  | "pop"
  | "chill"
  | "cinematic"
  | "ambient"
  | "trap"
  | "synthwave"
  | "funk"
  | "dnb"
  | "corporate"

export type Energy = "low" | "mid" | "high" | "build" | "break"

export type MusicOptions = {
  style?: Style
  /** Beats per minute, 60–180. Each style has its own default. */
  bpm?: number
  /** "C", "F#", "Bb"… */
  key?: string
  /** Each style has its own default. */
  scale?: "major" | "minor"
  /** Scale degrees 1–7, one chord per bar, repeated. Default: the seed's. */
  chords?: number[]
  /** The song's shape, in order. Default: "bars" bars, "intro" of them a
   * build, the rest high. */
  sections?: { bars: number; energy: Energy }[]
  /** Length in bars of four beats, when there are no sections. */
  bars?: number
  /** Bars of build before the drop, when there are no sections. */
  intro?: number
  /** End on one hit and a held chord over the last bar. Default true. */
  ending?: boolean
  /** Another seed is another song in the same style. */
  seed?: number
  fps?: number
}

export type Music = {
  bpm: number
  /** Frames per beat, fractional. A bar is four. */
  beatFrames: number
  /** Frames the song lasts — the composition's durationInFrames. */
  durationInFrames: number
  /** Where each section starts and ends, in frames, with its energy. */
  sections: { from: number; to: number; energy: Energy }[]
  /** Which section a frame is in. */
  sectionAt: (frame: number) => number
  /** The frame of beat n; beat 0 is frame 0. */
  beat: (n: number) => number
  /** The frame bar n starts on. */
  bar: (n: number) => number
  /** Which beat a frame is in. */
  beatAt: (frame: number) => number
  /** 1 on each beat (or every "every" beats), falling to 0 before the next. */
  pulse: (frame: number, decay?: number, every?: number) => number
  /** 1 where the kick lands, decaying — 0 where the song has no kick. */
  kick: (frame: number) => number
  /** The same for the snare or clap. */
  snare: (frame: number) => number
  /** The same for the crash that opens a section. */
  crash: (frame: number) => number
  /** Plays the song with Tone.js and answers with a WAV data URL. Slow-ish
   * (a second or two) and not quite the same twice — Tone's noise and reverb
   * are random — so Root.tsx calls it once, in calculateMetadata, and every
   * frame gets the same audio as a prop. */
  render: () => Promise<string>
}

type KickSound = "punch" | "boom" | "soft" | "tight"
type SnareSound = "snare" | "clap" | "rim"
type BassSound = "saw" | "sub" | "808" | "pluck" | "reese" | "fm"
type ChordSound = "pad" | "supersaw" | "strings" | "epiano" | "piano" | "stab"
type LeadSound = "pluck" | "bell" | "square" | "epiano" | "piano" | "saw"

/**
 * A groove, one bar of sixteenth notes per line. Kick and snare: x hit,
 * X accent, g ghost. Hats: x closed, o open, r a roll of two, t a triplet.
 * Perc: s shaker, t tom, c clap layered on the snare.
 */
type Groove = { kick: string; snare: string; hat: string; perc?: string }

/** One chord per hit. "hold" sustains the bar. */
type Comp = { sound: ChordSound; rhythm: string }

type StyleDef = {
  bpm: number
  scale: "major" | "minor"
  /** How late the off sixteenths land, as a fraction of one. */
  swing: number
  kick: KickSound
  snare: SnareSound
  grooves: Groove[]
  bass: BassSound[]
  /** 1 root, 8 the octave above, 5 the fifth, 3 the third, - hold, . rest. */
  bassLines: string[]
  comps: Comp[]
  sevenths: boolean
  leads: LeadSound[]
  /** Chord tones as indexes into the voicing (3 an octave up), one per
   * sixteenth; empty for no arpeggio. */
  arps: string[]
  /** How busy the melody is, 0–1. */
  melody: number
  reverb: number
  /** Dotted-eighth echo on the melody. */
  delay: number
  /** How far the kick pushes everything else down. */
  duck: number
  /** Where the pads' filter sits. */
  cutoff: number
  crackle?: boolean
}

const HOLD = "x..............."

const STYLES: Record<Style, StyleDef> = {
  house: {
    bpm: 124,
    scale: "minor",
    swing: 0.05,
    kick: "punch",
    snare: "clap",
    grooves: [
      {
        kick: "x...x...x...x...",
        snare: "....x.......x...",
        hat: "x.o.x.o.x.o.x.o.",
      },
      {
        kick: "x...x...x...x...",
        snare: "....x.......x...",
        hat: "xxoxxxoxxxoxxxox",
      },
      {
        kick: "x...x...x...x..x",
        snare: "....x.......x...",
        hat: "..o...o...o...o.",
        perc: "s.s.s.s.s.s.s.s.",
      },
    ],
    bass: ["saw", "pluck", "fm"],
    bassLines: ["..1...1...1...1.", "..1.1.1...1.8.1.", "1.8.1.8.1.8.1.8."],
    comps: [
      { sound: "stab", rhythm: "..x...x...x...x." },
      { sound: "supersaw", rhythm: HOLD },
      { sound: "piano", rhythm: "x..x..x...x..x.." },
    ],
    sevenths: false,
    leads: ["pluck", "bell", "saw"],
    arps: ["0121012101210121", "0213021302130213", ""],
    melody: 0.35,
    reverb: 0.25,
    delay: 0.2,
    duck: 0.5,
    cutoff: 1800,
  },
  pop: {
    bpm: 108,
    scale: "major",
    swing: 0,
    kick: "punch",
    snare: "snare",
    grooves: [
      {
        kick: "x.......x.x.....",
        snare: "....x.......x...",
        hat: "x.x.x.x.x.x.x.x.",
      },
      {
        kick: "x..x....x.x.....",
        snare: "....x.......x...",
        hat: "x.xxx.x.x.xxx.x.",
        perc: "....c.......c...",
      },
      {
        kick: "x.....x.x.......",
        snare: "....x.......x..g",
        hat: "xxxxxxxxxxxxxxxx",
      },
    ],
    bass: ["saw", "pluck", "sub"],
    bassLines: ["1.1.1.1.1.1.1.8.", "1..1..1.1..1..5.", "1-------5---8---"],
    comps: [
      { sound: "piano", rhythm: "x..x..x.x..x..x." },
      { sound: "supersaw", rhythm: HOLD },
      { sound: "epiano", rhythm: "x.x.x.x.x.x.x.x." },
    ],
    sevenths: false,
    leads: ["pluck", "bell", "square"],
    arps: ["0123012301230123", ""],
    melody: 0.45,
    reverb: 0.25,
    delay: 0.15,
    duck: 0.25,
    cutoff: 2200,
  },
  chill: {
    bpm: 82,
    scale: "minor",
    swing: 0.3,
    kick: "soft",
    snare: "rim",
    grooves: [
      {
        kick: "x......x..x.....",
        snare: "....x.......x...",
        hat: "x.x.x.x.x.x.x.x.",
      },
      {
        kick: "x.........x..x..",
        snare: "....x.......x...",
        hat: "x.xxx.x.x.xxx.x.",
      },
      {
        kick: "x......x.x......",
        snare: "....x..g....x...",
        hat: "..x...x...x...x.",
        perc: "s.s.s.s.s.s.s.s.",
      },
    ],
    bass: ["sub", "fm"],
    bassLines: ["1.....1...5.....", "1-------3---5---", "1.......1..5.8.."],
    comps: [
      { sound: "epiano", rhythm: "x.....x...x....." },
      { sound: "epiano", rhythm: HOLD },
      { sound: "piano", rhythm: "x.......x..x...." },
    ],
    sevenths: true,
    leads: ["epiano", "bell", "piano"],
    arps: [""],
    melody: 0.3,
    reverb: 0.35,
    delay: 0.25,
    duck: 0.15,
    cutoff: 900,
    crackle: true,
  },
  cinematic: {
    bpm: 92,
    scale: "minor",
    swing: 0,
    kick: "boom",
    snare: "snare",
    grooves: [
      {
        kick: "x.........x.....",
        snare: "........x.......",
        hat: "",
        perc: "..t...t...t.t.t.",
      },
      {
        kick: "x.....x...x.....",
        snare: "........x.......",
        hat: "x.x.x.x.x.x.x.x.",
        perc: "t.......t.t.t.t.",
      },
    ],
    bass: ["sub", "saw"],
    bassLines: ["1---------------", "1-------5-------"],
    comps: [
      { sound: "strings", rhythm: HOLD },
      { sound: "pad", rhythm: HOLD },
    ],
    sevenths: false,
    leads: ["piano", "bell"],
    arps: ["0101010101010101", "0202020202020202", ""],
    melody: 0.25,
    reverb: 0.5,
    delay: 0.2,
    duck: 0,
    cutoff: 1400,
  },
  ambient: {
    bpm: 70,
    scale: "major",
    swing: 0,
    kick: "soft",
    snare: "rim",
    grooves: [{ kick: "", snare: "", hat: "" }],
    bass: ["sub"],
    bassLines: ["1---------------"],
    comps: [
      { sound: "pad", rhythm: HOLD },
      { sound: "strings", rhythm: HOLD },
    ],
    sevenths: true,
    leads: ["bell", "epiano"],
    arps: ["0.2.1.3.0.2.1.3.", ""],
    melody: 0.2,
    reverb: 0.6,
    delay: 0.35,
    duck: 0,
    cutoff: 700,
  },
  trap: {
    bpm: 140,
    scale: "minor",
    swing: 0,
    kick: "boom",
    snare: "clap",
    grooves: [
      {
        kick: "x......x..x.....",
        snare: "........x.......",
        hat: "x.x.x.x.x.xrx.x.",
      },
      {
        kick: "x.....x...x..x..",
        snare: "........x.......",
        hat: "x.x.xrx.x.x.t.x.",
      },
      {
        kick: "x.......xx......",
        snare: "........x......g",
        hat: "xxx.x.xtx.x.rrx.",
      },
    ],
    bass: ["808"],
    bassLines: ["1......1..1.....", "1-----1---5--1--", "1.......1-----8."],
    comps: [
      { sound: "pad", rhythm: HOLD },
      { sound: "piano", rhythm: "x.......x......." },
      { sound: "strings", rhythm: HOLD },
    ],
    sevenths: false,
    leads: ["bell", "pluck"],
    arps: [""],
    melody: 0.35,
    reverb: 0.2,
    delay: 0.25,
    duck: 0,
    cutoff: 1100,
  },
  synthwave: {
    bpm: 100,
    scale: "minor",
    swing: 0,
    kick: "punch",
    snare: "snare",
    grooves: [
      {
        kick: "x.......x.......",
        snare: "....x.......x...",
        hat: "x.x.x.x.x.x.x.x.",
      },
      {
        kick: "x...x...x...x...",
        snare: "....x.......x...",
        hat: "xxxxxxxxxxxxxxxx",
      },
    ],
    bass: ["saw", "pluck"],
    bassLines: ["1.1.1.1.1.1.1.1.", "1.8.1.8.1.8.1.8.", "1111111111111111"],
    comps: [
      { sound: "supersaw", rhythm: HOLD },
      { sound: "strings", rhythm: HOLD },
    ],
    sevenths: false,
    leads: ["square", "saw"],
    arps: ["0123012301230123", "0121312101213121", ""],
    melody: 0.4,
    reverb: 0.35,
    delay: 0.35,
    duck: 0.35,
    cutoff: 2000,
  },
  funk: {
    bpm: 112,
    scale: "minor",
    swing: 0.12,
    kick: "punch",
    snare: "snare",
    grooves: [
      {
        kick: "x...x...x...x...",
        snare: "....x.......x...",
        hat: "x.o.x.o.x.o.x.o.",
        perc: "ssssssssssssssss",
      },
      {
        kick: "x..x..x...x.....",
        snare: "....x..g.g..x...",
        hat: "xxxxxxxxxxxxxxxx",
      },
      {
        kick: "x.....x.x.....x.",
        snare: "....x.......x.g.",
        hat: "x.x.x.x.x.x.x.x.",
        perc: "....c.......c...",
      },
    ],
    bass: ["fm", "pluck"],
    bassLines: ["1.8.1.81.1.8..58", "1..8..1.1..8.5.3", "1.8..81.1.8..8.5"],
    comps: [
      { sound: "epiano", rhythm: "..x..x....x..x.." },
      { sound: "stab", rhythm: "..x...x...x..x.." },
      { sound: "piano", rhythm: "x..x..x...x.x..." },
    ],
    sevenths: true,
    leads: ["square", "pluck", "epiano"],
    arps: [""],
    melody: 0.45,
    reverb: 0.2,
    delay: 0.1,
    duck: 0.2,
    cutoff: 1800,
  },
  dnb: {
    bpm: 172,
    scale: "minor",
    swing: 0,
    kick: "tight",
    snare: "snare",
    grooves: [
      {
        kick: "x.........x.....",
        snare: "....x.......x...",
        hat: "x.x.x.x.x.x.x.x.",
      },
      {
        kick: "x.........xx....",
        snare: "....x..g....x..g",
        hat: "xxx.xxx.xxx.xxx.",
      },
      {
        kick: "x.x.......x.....",
        snare: "....x.......x...",
        hat: "x.xxx.x.x.xxx.x.",
        perc: "s.s.s.s.s.s.s.s.",
      },
    ],
    bass: ["reese", "sub"],
    bassLines: ["1-------5-------", "1-----------8---", "1---1---5---3---"],
    comps: [
      { sound: "pad", rhythm: HOLD },
      { sound: "strings", rhythm: HOLD },
    ],
    sevenths: true,
    leads: ["bell", "pluck"],
    arps: ["0213021302130213", ""],
    melody: 0.3,
    reverb: 0.35,
    delay: 0.2,
    duck: 0.3,
    cutoff: 1300,
  },
  corporate: {
    bpm: 116,
    scale: "major",
    swing: 0,
    kick: "soft",
    snare: "clap",
    grooves: [
      {
        kick: "x...x...x...x...",
        snare: "....x.......x...",
        hat: "..x...x...x...x.",
        perc: "ssssssssssssssss",
      },
      {
        kick: "x.......x.x.....",
        snare: "....x.......x...",
        hat: "x.x.x.x.x.x.x.x.",
        perc: "s.s.s.s.s.s.s.s.",
      },
    ],
    bass: ["pluck", "saw"],
    bassLines: ["1.1.1.1.1.1.1.1.", "1...1...1.5.8...", "1.1.5.5.8.8.5.5."],
    comps: [
      { sound: "piano", rhythm: "x.x.x.x.x.x.x.x." },
      { sound: "piano", rhythm: "x..x..x.x..x..x." },
      { sound: "stab", rhythm: "x...x...x...x..." },
    ],
    sevenths: false,
    leads: ["bell", "pluck", "piano"],
    arps: ["0123012301230123", "0213021302130213"],
    melody: 0.4,
    reverb: 0.25,
    delay: 0.15,
    duck: 0.2,
    cutoff: 2400,
  },
}

const PROGRESSIONS = {
  major: [
    [1, 5, 6, 4],
    [1, 6, 4, 5],
    [6, 4, 1, 5],
    [1, 4, 6, 5],
    [4, 1, 5, 6],
    [1, 5, 4, 5],
    [1, 3, 6, 4],
    [4, 5, 3, 6],
  ],
  minor: [
    [1, 6, 3, 7],
    [1, 7, 6, 7],
    [1, 4, 7, 3],
    [6, 7, 1, 1],
    [1, 6, 7, 5],
    [1, 3, 7, 6],
    [4, 6, 1, 7],
    [1, 1, 6, 7],
  ],
}

const NOTES: Record<string, number> = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
}
const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
}

function hz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}


/** A drum or effect hit, in seconds from the start. */
type Hit = { at: number; gain: number }
/** A note held for "held" seconds. */
type Note = { at: number; held: number; midi: number; gain: number }
type ChordNote = Note & { sound: ChordSound }

/** Everything the song plays, decided before a sound is made — so the timing
 * helpers need no audio, and the audio is one pass over this. */
type Score = {
  kick: Hit[]
  snare: Hit[]
  hat: Hit[]
  open: Hit[]
  shaker: Hit[]
  tom: Note[]
  crash: Hit[]
  impact: Hit[]
  riser: Note[]
  bass: Note[]
  chords: ChordNote[]
  arp: Note[]
  lead: Note[]
}

type Picks = {
  style: StyleDef
  bass: BassSound
  lead: LeadSound
  brightness: number
  bpm: number
  seconds: number
}

export function music(options: MusicOptions = {}): Music {
  const style = STYLES[options.style ?? "pop"] ?? STYLES.pop
  const bpm = Math.min(180, Math.max(60, options.bpm ?? style.bpm))
  const fps = options.fps ?? 30
  const scaleName = options.scale ?? style.scale
  const scale = SCALES[scaleName]
  const tonic = NOTES[options.key ?? "A"] ?? 9

  // The seed chooses the song, deterministically: the timing helpers are
  // read in every render tab and must agree.
  let state = ((options.seed ?? 1) * 2654435761) >>> 0 || 1
  const choose = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0xffffffff
  }
  const pick = <T>(list: T[]): T =>
    list[Math.floor(choose() * list.length) % list.length]!

  const groove = pick(style.grooves)
  const bassSound = pick(style.bass)
  const bassLine = pick(style.bassLines)
  const comp = pick(style.comps)
  const lead = pick(style.leads)
  const arp = pick(style.arps)
  const progression =
    options.chords && options.chords.length > 0
      ? options.chords.map((d) => Math.min(7, Math.max(1, Math.round(d))))
      : pick(PROGRESSIONS[scaleName])
  const fill = pick(["snare", "toms", "kicks", "roll"] as const)
  const brightness = 0.8 + choose() * 0.5

  const sections = sectionsOf(options)
  const totalBars = sections.reduce((sum, section) => sum + section.bars, 0)
  const ending = (options.ending ?? true) && totalBars >= 2

  const beatSeconds = 60 / bpm
  const step = beatSeconds / 4
  const barSeconds = 16 * step
  const songSeconds = totalBars * barSeconds
  const at = (bar: number, s: number) =>
    bar * barSeconds + s * step + (s % 2 === 1 ? style.swing * step : 0)

  const score: Score = {
    kick: [],
    snare: [],
    hat: [],
    open: [],
    shaker: [],
    tom: [],
    crash: [],
    impact: [],
    riser: [],
    bass: [],
    chords: [],
    arp: [],
    lead: [],
  }
  const snare = (time: number, gain: number) => {
    if (style.snare === "clap")
      for (const offset of [0, 0.01, 0.021])
        score.snare.push({ at: time + offset, gain: offset ? gain * 0.7 : gain })
    else score.snare.push({ at: time, gain })
  }

  // Harmony.
  const degree = (d: number, octave: number) => {
    const index = d - 1
    const wrapped = ((index % 7) + 7) % 7
    return 12 * (octave + 1 + Math.floor(index / 7)) + tonic + scale[wrapped]!
  }
  /** A chord's notes, folded into one octave around middle C so the chords
   * move by the nearest notes rather than leaping with the root. */
  const voicing = (d: number) =>
    [d, d + 2, d + 4, ...(style.sevenths ? [d + 6] : [])]
      .map((n) => {
        let note = degree(n, 3)
        while (note < 55) note += 12
        while (note > 67) note -= 12
        return note
      })
      .sort((a, b) => a - b)
  const chordOf = (bar: number) => progression[bar % progression.length]!

  // The melody: a two-bar motif of rhythm and contour, played over whatever
  // chord is under it — strong steps land on a chord tone — and answered by a
  // variation, so a phrase is four bars that repeat with a difference.
  type Step = { step: number; move: number }
  const motif = (density: number): Step[] => {
    const steps: Step[] = []
    for (let s = 0; s < 32; s++) {
      const weight =
        s % 8 === 0 ? 0.95 : s % 4 === 0 ? 0.6 : s % 2 === 0 ? 0.4 : 0.15
      if (s === 0 || choose() < Math.min(0.95, weight * density * 1.7))
        steps.push({ step: s, move: Math.round((choose() - 0.5) * 4.4) })
    }
    return steps
  }
  const motifA = motif(style.melody)
  const motifB = motif(style.melody)
  const answer = [
    ...motifA.filter((note) => note.step < 16),
    ...motifB.filter((note) => note.step >= 16),
  ]
  let melodyDegree = 8
  const legato = lead === "square" || lead === "saw"
  const melodyBar = (bar: number, gain: number) => {
    const phraseBar = bar % 4
    const half = phraseBar % 2
    const mine = (phraseBar < 2 ? motifA : answer).filter(
      (note) => Math.floor(note.step / 16) === half
    )
    const chord = chordOf(bar)
    mine.forEach((note, i) => {
      const s = note.step % 16
      const next = mine[i + 1] ? mine[i + 1]!.step % 16 : 16
      const last = phraseBar === 3 && i === mine.length - 1
      let target = melodyDegree + note.move
      if (s % 4 === 0 || last) {
        // The nearest chord tone — the root itself, to close a phrase.
        let best = target
        let distance = Infinity
        for (let d = 4; d <= 16; d++) {
          const relative = (((d - chord) % 7) + 7) % 7
          if (relative !== 0 && (last || (relative !== 2 && relative !== 4)))
            continue
          if (Math.abs(d - target) < distance) {
            distance = Math.abs(d - target)
            best = d
          }
        }
        target = best
      }
      melodyDegree = Math.min(15, Math.max(5, target))
      const steps = last ? 16 - s : legato ? next - s : Math.min(4, next - s)
      score.lead.push({
        at: at(bar, s),
        held: steps * step * 0.95,
        midi: degree(melodyDegree, 4),
        gain,
      })
    })
  }

  // The song, bar by bar.
  let bar = 0
  sections.forEach((section, index) => {
    const next = sections[index + 1]
    for (let inSection = 0; inSection < section.bars; inSection++, bar++) {
      const chord = chordOf(bar)
      const notes = voicing(chord)
      const root = degree(chord, 1)
      const energy = section.energy
      const lastOfSection = inSection === section.bars - 1
      const start = at(bar, 0)

      if (ending && bar === totalBars - 1) {
        if (groove.kick) score.impact.push({ at: start, gain: 1 })
        score.bass.push({ at: start, held: barSeconds * 0.7, midi: root, gain: 0.9 })
        const sound: ChordSound =
          comp.sound === "piano" || comp.sound === "epiano" ? comp.sound : "pad"
        for (const midi of notes)
          score.chords.push({ at: start, held: barSeconds * 0.6, midi, gain: 0.6, sound })
        score.lead.push({ at: start, held: barSeconds * 0.6, midi: degree(8, 4), gain: 0.5 })
        continue
      }

      const drumsIn = energy === "mid" || energy === "high"
      if (
        inSection === 0 &&
        drumsIn &&
        (index > 0 || energy === "high") &&
        groove.kick
      ) {
        if (index > 0 && sections[index - 1]!.energy === "build")
          score.impact.push({ at: start, gain: 1 })
        else score.crash.push({ at: start, gain: 0.8 })
      }

      // Drums.
      const filling = drumsIn && lastOfSection && next !== undefined
      for (let s = 0; s < 16; s++) {
        const time = at(bar, s)
        const inFill = filling && s >= 12
        const k = groove.kick[s] ?? "."
        const n = groove.snare[s] ?? "."
        const h = groove.hat[s] ?? "."
        const p = groove.perc?.[s] ?? "."
        if (drumsIn && !inFill) {
          if (k !== ".") score.kick.push({ at: time, gain: k === "X" ? 1 : 0.95 })
          if (n === "x" || n === "X") snare(time, 0.9)
          if (n === "g" && energy === "high") snare(time, 0.3)
          if (p === "c") snare(time, 0.5)
          if (p === "t")
            score.tom.push({ at: time, held: 0.3, midi: degree(chord, 2), gain: 0.8 })
        }
        const hatsIn =
          drumsIn || energy === "build" || (energy === "low" && s % 2 === 0)
        if (hatsIn && !inFill) {
          const soft = energy === "high" ? 1 : 0.6
          if (h === "x")
            score.hat.push({ at: time, gain: soft * (s % 4 === 0 ? 0.9 : 0.6) })
          if (h === "o") score.open.push({ at: time, gain: soft * 0.8 })
          if (h === "r")
            for (const o of [0, 0.5])
              score.hat.push({ at: time + o * step, gain: soft * 0.55 })
          if (h === "t")
            for (const o of [0, 1 / 3, 2 / 3])
              score.hat.push({ at: time + o * step, gain: soft * 0.5 })
          if (p === "s" && (drumsIn || energy === "low"))
            score.shaker.push({ at: time, gain: energy === "high" ? 1 : 0.6 })
        }
        if (inFill) {
          const level = 0.5 + (s - 12) * 0.15
          if (fill === "snare") snare(time, level)
          if (fill === "toms")
            score.tom.push({
              at: time,
              held: 0.3,
              midi: degree(chord, 2) + 12 - (s - 12) * 3,
              gain: 0.9,
            })
          if (fill === "kicks") {
            if (s % 2 === 0) score.kick.push({ at: time, gain: 0.9 })
            else snare(time, level)
          }
          if (fill === "roll")
            for (const o of [0, 0.5]) snare(time + o * step, level * 0.8)
        }
      }
      if (energy === "build") {
        if (lastOfSection) {
          score.riser.push({ at: start, held: barSeconds, midi: 0, gain: 1 })
          for (let s = 0; s < 16; s += s < 8 ? 2 : 1)
            snare(at(bar, s), 0.25 + 0.6 * (s / 16))
        } else if (groove.snare && inSection % 2 === 1) {
          snare(at(bar, 12), 0.35)
        }
      }

      // Bass.
      if (drumsIn) {
        for (let s = 0; s < 16; s++) {
          const c = bassLine[s] ?? "."
          if (c === "." || c === "-") continue
          let held = 1
          while (s + held < 16 && bassLine[s + held] === "-") held++
          const midi =
            c === "8"
              ? root + 12
              : c === "5"
                ? degree(chord + 4, 1)
                : c === "3"
                  ? degree(chord + 2, 1)
                  : root
          score.bass.push({
            at: at(bar, s),
            held: held * step * 0.9,
            midi: midi < 31 ? midi + 12 : midi,
            gain: energy === "high" ? 0.9 : 0.75,
          })
        }
      } else if (
        energy === "break" &&
        (style.bass.includes("sub") || style.bass.includes("808"))
      ) {
        score.bass.push({ at: start, held: barSeconds * 0.95, midi: root, gain: 0.5 })
      }

      // Chords: the comp in the groove, held everywhere else.
      const chordGain =
        energy === "high"
          ? 0.75
          : energy === "mid"
            ? 0.7
            : energy === "break"
              ? 0.45
              : 0.6
      const struck = comp.sound === "piano" || comp.sound === "epiano"
      const sound: ChordSound = drumsIn
        ? comp.sound
        : struck || comp.sound === "strings" || comp.sound === "pad"
          ? comp.sound
          : "pad"
      // A struck chord held for a whole bar is struck again halfway.
      const rhythm = drumsIn ? comp.rhythm : struck ? "x.......x......." : HOLD
      const hits = [...rhythm]
        .map((c, s) => (c === "x" ? s : -1))
        .filter((s) => s >= 0)
      hits.forEach((s, i) => {
        const until = hits[i + 1] ?? 16
        for (const midi of notes)
          score.chords.push({
            at: at(bar, s),
            held: (until - s) * step * 0.92,
            midi,
            gain: chordGain,
            sound,
          })
      })

      // Arpeggio.
      if (arp && drumsIn) {
        for (let s = 0; s < 16; s++) {
          const c = arp[s] ?? "."
          if (c === ".") continue
          const index = Number(c)
          const note = index >= notes.length ? notes[0]! + 12 : notes[index]!
          score.arp.push({
            at: at(bar, s),
            held: step,
            midi: note + 12,
            gain: energy === "high" ? 0.6 : 0.45,
          })
        }
      }

      // Melody.
      if (energy === "high" || energy === "break")
        melodyBar(bar, energy === "break" ? 0.8 : 0.75)
    }
  })

  const beatFrames = (fps * 60) / bpm
  const durationInFrames = Math.round(songSeconds * fps)
  const beat = (n: number) => Math.max(0, Math.round(n * beatFrames))
  const bounds: { from: number; to: number; energy: Energy }[] = []
  let first = 0
  for (const section of sections) {
    bounds.push({
      from: beat(first * 4),
      to: beat((first + section.bars) * 4),
      energy: section.energy,
    })
    first += section.bars
  }

  const times = (hits: Hit[]) => hits.map((hit) => hit.at).sort((a, b) => a - b)
  const kicks = times([...score.kick, ...score.impact])
  const snares = times(score.snare)
  const crashes = times([...score.crash, ...score.impact])
  const envelope = (hits: number[], frame: number, decay: number) => {
    const t = frame / fps
    let last = -1
    for (const hit of hits) if (hit <= t + 0.5 / fps) last = hit
    return last < 0 ? 0 : Math.exp(-Math.max(0, t - last) * decay)
  }

  const picks: Picks = {
    style,
    bass: bassSound,
    lead,
    brightness,
    bpm,
    seconds: songSeconds,
  }

  return {
    bpm,
    beatFrames,
    durationInFrames,
    sections: bounds,
    sectionAt: (frame) => {
      const index = bounds.findIndex((section) => frame < section.to)
      return index < 0 ? bounds.length - 1 : index
    },
    beat,
    bar: (n) => beat(n * 4),
    beatAt: (frame) => Math.floor(frame / beatFrames),
    pulse: (frame, decay = 5, every = 1) => {
      const span = beatFrames * every
      const since = ((frame % span) + span) % span
      return Math.exp((-decay * since) / span)
    },
    kick: (frame) => envelope(kicks, frame, 8),
    snare: (frame) => envelope(snares, frame, 10),
    crash: (frame) => envelope(crashes, frame, 2),
    render: () => perform(score, picks),
  }
}

function sectionsOf(options: MusicOptions): { bars: number; energy: Energy }[] {
  const energies: Energy[] = ["low", "mid", "high", "build", "break"]
  const given = (options.sections ?? [])
    .map((section) => ({
      bars: Math.max(1, Math.round(section.bars)),
      energy: energies.includes(section.energy) ? section.energy : "high",
    }))
    .slice(0, 32)
  if (given.length > 0) return given
  const bars = Math.max(1, Math.round(options.bars ?? 8))
  const intro = Math.min(bars - 1, Math.max(0, Math.round(options.intro ?? 0)))
  return [
    ...(intro > 0 ? [{ bars: intro, energy: "build" as const }] : []),
    { bars: bars - intro, energy: "high" as const },
  ]
}

/**
 * The score, played by Tone.js into an offline context and written as a WAV
 * data URL. Tone is imported here, not at the top: only Root's
 * calculateMetadata plays the song, and the render tabs need not load it.
 */
async function perform(score: Score, picks: Picks): Promise<string> {
  const Tone = await import("tone")
  const { style, brightness, bpm } = picks
  const beat = 60 / bpm

  const rendered = await Tone.Offline(
    async () => {
      const limiter = new Tone.Limiter(-1).toDestination()
      const glue = new Tone.Compressor({ threshold: -18, ratio: 3 }).connect(limiter)
      const drums = new Tone.Gain(1).connect(glue)
      // Everything but the drums, so the kick can push it down.
      const tonal = new Tone.Gain(1).connect(glue)
      // The reverb is a convolution with a tail made here: Freeverb, Tone's
      // own, runs in an AudioWorklet, which a page loaded from a file cannot
      // start. Seeded noise, so a render again is the same room.
      const room = new Tone.Convolver(
        Tone.ToneAudioBuffer.fromArray(roomTail(1.2 + style.reverb * 2.2))
      ).connect(glue)
      const echo = new Tone.FeedbackDelay({
        delayTime: beat * 0.75,
        feedback: 0.35,
        wet: 1,
      }).connect(glue)
      const send = (amount: number) => {
        const gain = new Tone.Gain(amount)
        gain.connect(room)
        return gain
      }
      const reverbSend = send(style.reverb)

      // Drums.
      const kick = new Tone.MembraneSynth({
        pitchDecay: style.kick === "boom" ? 0.08 : 0.04,
        octaves: style.kick === "soft" ? 4 : 6,
        envelope: {
          attack: 0.001,
          decay:
            style.kick === "boom" ? 1.2 : style.kick === "tight" ? 0.25 : 0.4,
          sustain: 0,
          release: 0.05,
        },
      })
      if (style.kick === "boom")
        kick.chain(new Tone.Distortion(0.35), drums)
      else kick.connect(drums)
      kick.volume.value = style.kick === "soft" ? -4 : 0

      const snareTone =
        style.snare === "clap"
          ? new Tone.Filter({ frequency: 1300, type: "bandpass", Q: 0.8 })
          : new Tone.Filter({ frequency: style.snare === "rim" ? 2500 : 1200, type: "highpass" })
      snareTone.fan(drums, reverbSend)
      const snare = new Tone.NoiseSynth({
        noise: { type: "white" },
        envelope: {
          attack: 0.001,
          decay: style.snare === "clap" ? 0.12 : style.snare === "rim" ? 0.04 : 0.18,
          sustain: 0,
          release: 0.02,
        },
      }).connect(snareTone)
      snare.volume.value = style.snare === "rim" ? -10 : -4
      const body = new Tone.MembraneSynth({
        pitchDecay: 0.01,
        octaves: 1.5,
        envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.02 },
      }).connect(drums)
      body.volume.value = style.snare === "snare" ? -8 : -60

      const metal = (decay: number, volume: number) => {
        const synth = new Tone.MetalSynth({
          envelope: { attack: 0.001, decay, release: 0.01 },
          harmonicity: 5.1,
          modulationIndex: 32,
          resonance: 4000,
          octaves: 1.5,
        }).connect(drums)
        synth.volume.value = volume
        return synth
      }
      const hat = metal(0.05, -22)
      const open = metal(0.3, -24)
      const crash = new Tone.MetalSynth({
        envelope: { attack: 0.001, decay: 1.8, release: 0.5 },
        harmonicity: 5.1,
        modulationIndex: 40,
        resonance: 5000,
        octaves: 1.5,
      }).fan(drums, reverbSend)
      crash.volume.value = -22
      const shaker = new Tone.NoiseSynth({
        envelope: { attack: 0.008, decay: 0.05, sustain: 0, release: 0.01 },
      }).connect(new Tone.Filter(5000, "highpass").connect(drums))
      shaker.volume.value = -20
      const tom = new Tone.MembraneSynth({
        pitchDecay: 0.03,
        octaves: 2,
        envelope: { attack: 0.001, decay: 0.35, sustain: 0, release: 0.05 },
      }).fan(drums, reverbSend)
      tom.volume.value = -4
      const boom = new Tone.MembraneSynth({
        pitchDecay: 0.2,
        octaves: 3,
        envelope: { attack: 0.001, decay: 1.6, sustain: 0, release: 0.2 },
      }).fan(drums, reverbSend)

      // Bass.
      const bassOut = new Tone.Gain(1).connect(tonal)
      const bass =
        picks.bass === "808"
          ? new Tone.MonoSynth({
              oscillator: { type: "sine" },
              envelope: { attack: 0.002, decay: 1.2, sustain: 0.5, release: 0.25 },
              filter: { type: "lowpass", frequency: 2000 },
              filterEnvelope: { baseFrequency: 2000, octaves: 0 },
            }).chain(new Tone.Distortion(0.4), bassOut)
          : picks.bass === "fm"
            ? new Tone.FMSynth({
                harmonicity: 1,
                modulationIndex: 4,
                envelope: { attack: 0.003, decay: 0.3, sustain: 0.4, release: 0.05 },
                modulationEnvelope: { attack: 0.002, decay: 0.15, sustain: 0.2, release: 0.05 },
              }).connect(bassOut)
            : new Tone.MonoSynth({
                oscillator:
                  picks.bass === "sub"
                    ? { type: "sine" }
                    : picks.bass === "reese"
                      ? { type: "fatsawtooth", count: 2, spread: 25 }
                      : { type: "sawtooth" },
                filter: { Q: 2, type: "lowpass", rolloff: -24 },
                envelope: {
                  attack: 0.004,
                  decay: 0.2,
                  sustain: picks.bass === "pluck" ? 0.3 : 0.7,
                  release: 0.05,
                },
                filterEnvelope: {
                  attack: 0.001,
                  decay: picks.bass === "pluck" ? 0.1 : 0.25,
                  sustain: picks.bass === "reese" ? 0.6 : 0.3,
                  release: 0.1,
                  baseFrequency: (picks.bass === "sub" ? 400 : 110) * brightness,
                  octaves: picks.bass === "sub" ? 0 : 3.2,
                },
              }).connect(bassOut)
      bass.volume.value = -6

      // Chords, one PolySynth per sound the song uses.
      const chordBus = new Tone.Gain(1)
      chordBus.fan(tonal, send(style.reverb * 1.4))
      const chorus = new Tone.Chorus(3, 2.5, 0.4).start()
      chorus.connect(chordBus)
      const chordSynths = new Map<ChordSound, { triggerAttackRelease: (note: number, held: number, at: number, velocity: number) => unknown }>()
      const chordSynth = (sound: ChordSound) => {
        const made = chordSynths.get(sound)
        if (made) return made
        const filter = new Tone.Filter(
          (sound === "supersaw" || sound === "stab" ? 2800 : style.cutoff) * brightness,
          "lowpass"
        ).connect(sound === "pad" || sound === "strings" || sound === "supersaw" ? chorus : chordBus)
        const synth =
          sound === "epiano"
            ? new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: 1,
                modulationIndex: 3,
                envelope: { attack: 0.002, decay: 1.6, sustain: 0.15, release: 0.8 },
                modulationEnvelope: { attack: 0.002, decay: 0.5, sustain: 0.1, release: 0.5 },
              })
            : sound === "piano"
              ? new Tone.PolySynth(Tone.Synth, {
                  oscillator: { type: "custom", partials: [1, 0.55, 0.3, 0.18, 0.1, 0.06] },
                  envelope: { attack: 0.002, decay: 1.3, sustain: 0.08, release: 0.6 },
                })
              : new Tone.PolySynth(Tone.Synth, {
                  oscillator: {
                    type: "fatsawtooth",
                    count: sound === "supersaw" ? 5 : 3,
                    spread: sound === "supersaw" ? 40 : sound === "strings" ? 18 : 22,
                  },
                  envelope:
                    sound === "stab"
                      ? { attack: 0.002, decay: 0.25, sustain: 0, release: 0.1 }
                      : {
                          attack: sound === "strings" ? 0.6 : sound === "pad" ? 0.4 : 0.08,
                          decay: 0.3,
                          sustain: 0.8,
                          release: sound === "supersaw" ? 0.4 : 1,
                        },
                })
        synth.maxPolyphony = 48
        synth.volume.value = sound === "piano" || sound === "epiano" ? -10 : -16
        synth.connect(filter)
        chordSynths.set(sound, synth)
        return synth
      }

      // Arpeggio and lead.
      const leadBus = new Tone.Gain(1)
      leadBus.fan(tonal, send(style.reverb * 1.2))
      const echoSend = new Tone.Gain(style.delay)
      echoSend.connect(echo)
      leadBus.connect(echoSend)
      // A pluck: a saw whose filter shuts at once. Not PluckSynth, which runs
      // in an AudioWorklet and asserts on two notes too close together.
      const plucks = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: "sawtooth" },
        filter: { type: "lowpass", Q: 1.5 },
        envelope: { attack: 0.002, decay: 0.4, sustain: 0, release: 0.2 },
        filterEnvelope: {
          attack: 0.001,
          decay: 0.18,
          sustain: 0,
          release: 0.2,
          baseFrequency: 500 * brightness,
          octaves: 3.5,
        },
      }).connect(leadBus)
      plucks.maxPolyphony = 32
      plucks.volume.value = -14
      const pluckAt = (note: Note) => {
        plucks.triggerAttackRelease(hz(note.midi), Math.min(note.held, 0.3), note.at, note.gain)
      }
      const leadSynth =
        picks.lead === "pluck"
          ? null
          : picks.lead === "bell" || picks.lead === "epiano"
            ? new Tone.PolySynth(Tone.FMSynth, {
                harmonicity: picks.lead === "bell" ? 3.5 : 1,
                modulationIndex: picks.lead === "bell" ? 8 : 3,
                envelope: { attack: 0.002, decay: 1.8, sustain: 0.1, release: 1 },
                modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0.1, release: 0.5 },
              })
            : picks.lead === "piano"
              ? new Tone.PolySynth(Tone.Synth, {
                  oscillator: { type: "custom", partials: [1, 0.55, 0.3, 0.18, 0.1, 0.06] },
                  envelope: { attack: 0.002, decay: 1.3, sustain: 0.08, release: 0.6 },
                })
              : new Tone.MonoSynth({
                  oscillator: { type: picks.lead === "square" ? "square" : "sawtooth" },
                  filter: { type: "lowpass", Q: 1 },
                  envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.15 },
                  filterEnvelope: {
                    attack: 0.01,
                    decay: 0.3,
                    sustain: 0.6,
                    release: 0.2,
                    baseFrequency: 900 * brightness,
                    octaves: 2,
                  },
                })
      if (leadSynth) {
        if (picks.lead === "square" || picks.lead === "saw")
          leadSynth.chain(new Tone.Vibrato(5.5, 0.08), leadBus)
        else leadSynth.connect(leadBus)
        leadSynth.volume.value = picks.lead === "square" || picks.lead === "saw" ? -16 : -10
      }

      // A riser: noise swept up through a band-pass, swelling into the drop.
      const riserOut = new Tone.Gain(0)
      riserOut.fan(drums, reverbSend)
      const riserFilter = new Tone.Filter({ frequency: 300, type: "bandpass", Q: 2 }).connect(riserOut)
      const riserNoise = new Tone.Noise("white").connect(riserFilter)

      // Playing it, one instrument at a time and in time order: a Tone
      // instrument cancels what is scheduled after a note it is given.
      const inOrder = <T extends { at: number }>(list: T[]) =>
        [...list].sort((a, b) => a.at - b.at)
      const once = <T extends { at: number }>(list: T[]) =>
        inOrder(list).filter((hit, i, all) => i === 0 || hit.at - all[i - 1]!.at > 0.002)

      for (const hit of once(score.kick))
        kick.triggerAttackRelease(style.kick === "boom" ? 42 : 50, 0.1, hit.at, hit.gain)
      for (const hit of once(score.snare)) {
        snare.triggerAttackRelease(0.1, hit.at, hit.gain)
        body.triggerAttackRelease(185, 0.05, hit.at, hit.gain)
      }
      for (const hit of once(score.hat)) hat.triggerAttackRelease(300, 0.03, hit.at, hit.gain)
      for (const hit of once(score.open)) open.triggerAttackRelease(300, 0.2, hit.at, hit.gain)
      for (const hit of once(score.shaker)) shaker.triggerAttackRelease(0.04, hit.at, hit.gain)
      for (const note of once(score.tom))
        tom.triggerAttackRelease(hz(note.midi), note.held, note.at, note.gain)
      for (const hit of once([...score.crash, ...score.impact]))
        crash.triggerAttackRelease(220, 1.5, hit.at, hit.gain)
      for (const hit of once(score.impact)) boom.triggerAttackRelease(32, 1, hit.at, 1)
      for (const rise of score.riser) {
        riserNoise.start(rise.at).stop(rise.at + rise.held)
        riserFilter.frequency.setValueAtTime(300, rise.at)
        riserFilter.frequency.exponentialRampToValueAtTime(7000, rise.at + rise.held)
        riserOut.gain.setValueAtTime(0, rise.at)
        riserOut.gain.linearRampToValueAtTime(0.35, rise.at + rise.held)
        riserOut.gain.setValueAtTime(0, rise.at + rise.held)
      }

      for (const note of once(score.bass))
        bass.triggerAttackRelease(hz(note.midi), note.held, note.at, note.gain)
      for (const note of inOrder(score.chords))
        chordSynth(note.sound).triggerAttackRelease(hz(note.midi), note.held, note.at, note.gain)
      for (const note of once(score.arp)) pluckAt(note)
      for (const note of once(score.lead)) {
        if (leadSynth)
          leadSynth.triggerAttackRelease(hz(note.midi), note.held, note.at, note.gain)
        else pluckAt(note)
      }

      // The kick pushes the rest down — the pump of a dance track.
      if (style.duck > 0) {
        for (const hit of once([...score.kick, ...score.impact])) {
          tonal.gain.setValueAtTime(1 - style.duck, hit.at)
          tonal.gain.linearRampToValueAtTime(1, hit.at + Math.min(0.22, beat * 0.6))
        }
      }
    },
    picks.seconds,
    2,
    RATE
  )

  const audio = rendered.get()
  if (!audio) throw new Error("Tone.js rendered no audio.")
  const channels = [audio.getChannelData(0), audio.getChannelData(Math.min(1, audio.numberOfChannels - 1))]

  // One loudness whatever the style — by the average, not the peak, or a
  // song of held pads came out twice as loud as one of drums — with tanh as
  // the limiter for the peaks this lets through, and fades against clicks.
  let power = 0
  for (const channel of channels) for (const sample of channel) power += sample * sample
  const gain = 0.2 / (Math.sqrt(power / (channels[0]!.length * 2)) || 1)
  const length = channels[0]!.length
  const bytes = new Uint8Array(44 + length * 4)
  const view = new DataView(bytes.buffer)
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i))
  }
  text(0, "RIFF")
  view.setUint32(4, 36 + length * 4, true)
  text(8, "WAVE")
  text(12, "fmt ")
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 2, true)
  view.setUint32(24, RATE, true)
  view.setUint32(28, RATE * 4, true)
  view.setUint16(32, 4, true)
  view.setUint16(34, 16, true)
  text(36, "data")
  view.setUint32(40, length * 4, true)
  for (let i = 0; i < length; i++) {
    const fade = Math.min(1, i / (0.005 * RATE), (length - i) / (0.05 * RATE))
    for (let c = 0; c < 2; c++) {
      const sample = 0.95 * Math.tanh(channels[c]![i]! * gain) * fade
      view.setInt16(44 + (i * 2 + c) * 2, Math.round(sample * 0x7fff), true)
    }
  }
  let binary = ""
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return "data:audio/wav;base64," + btoa(binary)
}

/** A reverb's impulse response: two channels of noise dying away over
 * "seconds", darker as it goes — what a room does to a click. */
function roomTail(seconds: number): Float32Array[] {
  let state = 0x2545f491
  return [0, 1].map(() => {
    const out = new Float32Array(Math.round(seconds * RATE))
    let low = 0
    for (let i = 0; i < out.length; i++) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0
      const white = (state / 0xffffffff) * 2 - 1
      const x = i / out.length
      low += (0.6 - 0.5 * x) * (white - low)
      out[i] = low * Math.pow(1 - x, 3) * 0.5
    }
    return out
  })
}
`
