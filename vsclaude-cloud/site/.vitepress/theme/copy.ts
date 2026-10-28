import { PRO_PLANS } from "../../../server/utils/billing.ts"

/**
 * Every word of the home page, in each language it is written in.
 *
 * English is the default (`/`), Vietnamese is `/vi/` — VitePress's locales,
 * one page each rather than a script swapping text, so the page arrives in
 * its language with nothing to flicker and a search engine can read both. It
 * was `/?lang=vi` while the Worker drew the page; `config.ts` sends that on.
 *
 * **The page leads with what Vey Studio is for, told as three steps**: add
 * every Claude account, carry a stopped chat on with `Continue with …`, and
 * every one of them free — Pro is every project after the first.
 * Running chats side by
 * side and reading their diffs is the studio around that, and comes second.
 *
 * **Plain words first.** A visitor may not know what a "5-hour window" is, so
 * the page talks about usage limits, says what the limit is once (the FAQ and
 * the "How it works" lede), and keeps the sentences short. What the
 * page promises is what the app does — a switch is the user's, made by the
 * limit card's `Continue with …` or the composer's account menu (nothing
 * switches by itself), and the conversation carries because
 * `carryTranscript` in the app's `src/main/chat.ts` moves the CLI's
 * transcript to the new account's directory. Accounts are added from the
 * Accounts list at the foot of the chats column — there is no Settings ›
 * Claude any more.
 *
 * What stays English on purpose is the app's own vocabulary — the studio's UI
 * is English, so "Continue with …", "Account" and the mode names are written
 * as the reader will find them on screen. The picture of the app in the hero
 * and the text inside the illustrations stay English for the same reason.
 *
 * Every language has the same shape (`Copy`), so a missing sentence is a type
 * error rather than a blank on the page.
 */

export type Lang = "en" | "vi"

/** `99.000 ₫` — the price as the checkout and the app's dialog write it. */
export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount)
}

export const LANGS: Lang[] = ["en", "vi"]

/** A locale's language, or English. */
export function langOf(value: unknown): Lang {
  return value === "vi" ? "vi" : "en"
}

/** Where a language's home page lives. English keeps the bare root. */
export function pathOf(lang: Lang): string {
  return lang === "en" ? "/" : `/${lang}/`
}

/** Where a language's guide lives. */
export function docsPathOf(lang: Lang): string {
  return `${pathOf(lang)}docs/`
}

/** Where the bar's Docs link goes: the guide's first page rather than its
 * index, which is a cover with nothing to read on it. */
export function docsStartOf(lang: Lang): string {
  return `${docsPathOf(lang)}getting-started`
}

/** Where a language's install page lives (`install.md`, `Install.vue`). */
export function installPathOf(lang: Lang): string {
  return `${pathOf(lang)}install`
}

type Plan = {
  name: string
  price: string
  /** After the price — `once`, `forever`. */
  term: string
  /** The small line under the price — `No account required`. */
  sub: string
  items: string[]
  /** The plan's button, drawn as the dialog draws it and inert: buying
   * happens in the app. */
  button: string
  /** A device plan, drawn in Pro's colours. */
  pro?: boolean
  /** The flag over the plan most people want. */
  flag?: string
}

/** The words of one device plan, by its seat count. */
type DeviceWords = {
  name: (seats: number) => string
  term: string
  sub: (seats: number) => string
  items: (seats: number) => string[]
  button: (seats: number) => string
  flag: string
}

/** The plan the page flags — the app's `POPULAR_SEATS`. */
const POPULAR_SEATS = 3

/**
 * The three device plans in a language, priced off `PRO_PLANS` — the server's
 * own list, so the page cannot advertise a price the checkout does not
 * charge (`test/home.test.ts`).
 */
function devicePlans(words: DeviceWords): Plan[] {
  return PRO_PLANS.map(({ seats, price }) => ({
    name: words.name(seats),
    price: formatVnd(price),
    term: words.term,
    sub: words.sub(seats),
    items: words.items(seats),
    button: words.button(seats),
    pro: true,
    ...(seats === POPULAR_SEATS ? { flag: words.flag } : {}),
  }))
}

/** The cheapest way into Pro, for the FAQ's price answer. */
const FROM_PRICE = formatVnd(PRO_PLANS[0]!.price)

type Section = {
  kicker: string
  title: string
  body: string
  items: { title: string; body: string }[]
}

export type Copy = {
  htmlLang: string
  /** The switch's own label for this language. */
  short: string
  title: string
  description: string
  ogDescription: string
  nav: {
    why: string
    features: string
    pricing: string
    faq: string
    /** The user's guide, `docsPathOf`. */
    docs: string
    download: string
    language: string
  }
  eyebrow: string
  /** The second half is the accent — set in serif italic. */
  h1: [plain: string, accent: string]
  lede: string
  cta: { download: string; downloadFor: string; pricing: string }
  /** Under the buttons: the platforms, linking to the install page — every
   * build, for whoever the button's guess was wrong for — then the rest of
   * the line. */
  fine: [platforms: string, rest: string]
  /** The three problems — in the order of `PILLAR_ORDER` in `home/demo.ts`. */
  pillars: Section
  /** The studio's main parts — in the order of `FEATURE_ORDER`. */
  features: Section
  pricing: {
    kicker: string
    title: [plain: string, accent: string]
    body: string
    /** Free, then the device plans, as the studio's Pro dialog has them —
     * `devicePlans`, priced off the figures the checkout charges. */
    plans: Plan[]
    /** The line under the plans: how Pro is paid. */
    pay: string
  }
  steps: {
    kicker: string
    title: string
    items: { title: string; body: string }[]
  }
  faq: { kicker: string; title: string; items: { q: string; a: string }[] }
  closing: [plain: string, accent: string]
  /** Under the picture of the app in the hero. */
  windowCaption: string
  footer: { download: string; product: string; tagline: string }
  /** The install page (`install/Install.vue`). */
  install: InstallCopy
}

type InstallCopy = {
  title: string
  description: string
  eyebrow: string
  h1: [plain: string, accent: string]
  lede: string
  /** The tabs' own label, for a screen reader. */
  platform: string
  /** "v1.0.17", once the latest release has answered. */
  version: (v: string) => string
  copy: string
  copied: string
  mac: {
    app: string
    appBody: string
    /** Why the `xattr` line: the builds are unsigned. */
    why: string
    arm64: string
    x64: string
  }
  windows: { app: string; appBody: string; button: string; smartScreen: string }
  linux: { app: string; appBody: string; button: string; fuse: string }
  after: {
    kicker: string
    title: string
    /** `doc` is the guide's page the step is told in full on, `docs/<doc>`. */
    items: { title: string; body: string; doc: string; more: string }[]
  }
  more: {
    kicker: string
    title: string
    releases: { title: string; body: string }
    update: { title: string; body: string }
    trouble: { title: string; body: string }
  }
}

const en: Copy = {
  htmlLang: "en",
  short: "EN",
  title:
    "Vey Studio: hit your Claude limit, keep working by switching accounts mid-chat",
  description:
    "A desktop app for Claude Code. Add all your Claude accounts; when one hits its usage limit, continue the same chat on another account with one click and nothing lost. Free with every account; Pro, bought once, adds every project you work on.",
  ogDescription:
    "Hit your Claude limit? Continue the same chat on another account in one click.",
  nav: {
    why: "How it works",
    features: "Features",
    pricing: "Pricing",
    faq: "FAQ",
    docs: "Docs",
    download: "Download",
    language: "Language",
  },
  eyebrow: "Free desktop app for Claude Code",
  h1: ["Hit your Claude limit?", "Keep working anyway."],
  lede: "Add all your Claude accounts to Vey Studio. When one runs out, continue the same chat on another account in one click. Nothing to copy, nothing to explain again.",
  cta: {
    download: "Download for free",
    downloadFor: "Download for ",
    pricing: "See pricing",
  },
  fine: [
    "macOS · Windows · Linux",
    "free with every Claude account, Pro once for every project",
  ],
  pillars: {
    kicker: "How it works",
    title: "A limit no longer means waiting",
    body: "Claude's plans cap how much you can use every 5 hours and every week. In plain Claude Code, reaching the cap stops your chat until it resets. In Vey Studio, it takes one click to carry on.",
    items: [
      {
        title: "Add all your accounts",
        body: "Work, personal, team: sign each in once. The list under your chats shows how much of its 5-hour and weekly limit every account has used, so you know which one has room.",
      },
      {
        title: "Hit a limit? Click “Continue”",
        body: "A stopped chat shows when its limit resets and a “Continue with …” button. Press it and the chat moves to an account with room, picking up right where it stopped.",
      },
      {
        title: "Free for every account",
        body: "Every account, the switch between them and your own API endpoints — GLM, Kimi, DeepSeek or a company gateway — are free. Pro adds every project after the first, bought once, never a subscription.",
      },
    ],
  },
  features: {
    kicker: "Features",
    title: "Everything around the chat, in one window",
    body: "See what Claude is doing, check what it changed and commit it, all without switching apps.",
    items: [
      {
        title: "Many chats at once",
        body: "Run several conversations side by side, and see at a glance which are working, which need you and which are done.",
      },
      {
        title: "Git, built in",
        body: "Review every change, commit with a message Claude drafts for you, and push.",
      },
      {
        title: "Undo by editing",
        body: "Edit an earlier message, and the files Claude changed after it go back too.",
      },
      {
        title: "You decide what it may do",
        body: "Five modes, from Plan (only reads and plans) to Full access. Change it any time, even mid-chat.",
      },
      {
        title: "Editor and terminal",
        body: "Open any file, see who last changed each line, and run commands right under the chat.",
      },
      {
        title: "Search everything",
        body: "Find any text across all your files and every past conversation.",
      },
    ],
  },
  pricing: {
    kicker: "Pricing",
    title: ["Free, then ", "Pro once"],
    body: "Every Claude account and custom API endpoint is free, as many as you have, in one project. Pro adds every project after it — bought once, by bank transfer, never a subscription.",
    plans: [
      {
        name: "Free",
        price: "0 ₫",
        term: "forever",
        sub: "No account required",
        items: [
          "Unlimited Claude accounts — claude.ai, Console, SSO",
          "“Continue with …” to another account when one hits its limit",
          "Custom API endpoints — GLM, Kimi, DeepSeek, OpenRouter, a company gateway",
          "One project — many chats at once, git, editor, terminal, search",
          "Every update · macOS, Windows, Linux",
        ],
        button: "Download free",
      },
      ...devicePlans({
        name: (n) => (n === 1 ? "1 Device" : `${n} Devices`),
        term: "once",
        sub: (n) =>
          `${n === 1 ? "1 device" : `${n} devices`} · updates forever`,
        items: (n) => [
          "Everything in Free",
          "Unlimited projects, each with its own chats, files and terminals",
          "Worktrees, search and tabs across all of them",
          `${n === 1 ? "1 device activation" : `${n} simultaneous activations`} · 7-day money-back guarantee`,
        ],
        button: (n) => (n === 1 ? "Buy 1 Device" : `Buy ${n} Devices`),
        flag: "Most popular",
      }),
    ],
    pay: "No account, no sign-in. Pick a plan in the app and enter your email; a VietQR page opens in your browser, Pro turns on for that device the moment the transfer arrives, and the licence key is mailed to you for the others.",
  },
  steps: {
    kicker: "Get started",
    title: "Up and running in a minute",
    items: [
      {
        title: "Download and open a folder",
        body: "For macOS, Windows or Linux. Pick a project folder already on your computer.",
      },
      {
        title: "Add your Claude accounts",
        body: "With Claude Code installed, press + beside Accounts at the bottom of the chats column, once for each account.",
      },
      {
        title: "Chat, and keep going",
        body: "Ask Claude to do the work. When a limit hits, press “Continue with …” on the chat and the conversation carries on.",
      },
    ],
  },
  faq: {
    kicker: "FAQ",
    title: "Questions, answered",
    items: [
      {
        q: "What is Vey Studio?",
        a: "A desktop app that runs Claude Code for you, in a window with your projects, several chats at once, your files, git and a terminal. What sets it apart: a chat can move between your Claude accounts when a usage limit hits.",
      },
      {
        q: "What is the 5-hour limit?",
        a: "Claude's Pro and Max plans let you use Claude Code up to a set amount in every 5-hour period, plus a weekly cap. Once you reach it, Claude Code stops until the limit resets. Vey Studio shows how much each of your accounts has left.",
      },
      {
        q: "What happens when I hit a limit?",
        a: "The chat stops on a card saying which limit it hit and when it resets. “Continue with …” moves it to your next account with room and sends it on. You can also pick an account yourself in the chat's composer. Either way the next message remembers everything said so far.",
      },
      {
        q: "How many Claude accounts can I add?",
        a: "As many as you have, on Free. Each signs in once and stays signed in, so any chat can run on any of them.",
      },
      {
        q: "What does Pro cost?",
        a: `From ${FROM_PRICE} for one device — or three or five — once, by bank transfer. There is no subscription and nothing to renew; every update is included, and the licence never expires. Not happy? A refund within 7 days.`,
      },
      {
        q: "Do I need Claude Code installed?",
        a: "Yes. The app runs your own claude CLI and signs each account in through it.",
      },
      {
        q: "What can I do without Pro?",
        a: "Everything with Claude accounts, in one project: add as many accounts as you have, switch a chat between them, every panel of the app. Custom API endpoints too. Only a second project needs Pro.",
      },
      {
        q: "Can I use Pro on another computer?",
        a: "Yes, as many as your plan's devices. Paste the licence key from your email into the Vey Pro dialog on the other computer. Moving to a new one? Deactivate the old one in the same dialog to free its seat.",
      },
      {
        q: "Where do my requests go?",
        a: "Straight from the app to Anthropic on your own accounts, or to the endpoint you set up. This server is only involved in buying Pro.",
      },
      {
        q: "How do I pay?",
        a: "By bank transfer with VietQR, from the app. Pro turns on the moment the transfer arrives, and the app tells you when.",
      },
      {
        q: "Which platforms?",
        a: "macOS 12 or newer, on Apple Silicon or Intel; Windows and Linux on x64. The app updates itself when a new release is out.",
      },
    ],
  },
  closing: ["Your limit isn't ", "your deadline."],
  windowCaption: "One conversation, any account.",
  footer: {
    download: "Download",
    product: "Product",
    tagline: "The desktop studio for Claude Code.",
  },
  install: {
    title: "Install Vey Studio for macOS, Windows or Linux",
    description:
      "Download Vey Studio, the free desktop app for Claude Code, for macOS, Windows or Linux.",
    eyebrow: "Free desktop app for Claude Code",
    h1: ["Install", "Vey Studio."],
    lede: "Download the app for your computer, then add your Claude accounts and start a chat.",
    platform: "Platform",
    version: (v) => `Latest: v${v}`,
    copy: "Copy",
    copied: "Copied",
    mac: {
      app: "Download the .dmg",
      appBody:
        "Open it and drag Vey Studio into Applications. Then run this once, or macOS will say the app is damaged:",
      why: "Vey Studio isn't signed with an Apple certificate yet, so macOS quarantines a .dmg downloaded in a browser and then says the app is “damaged”. The command above lifts that quarantine.",
      arm64: "Apple Silicon",
      x64: "Intel",
    },
    windows: {
      app: "Download the installer",
      appBody: "x64. Run the .exe; it installs the app and opens it.",
      button: "Download for Windows",
      smartScreen:
        "The installer isn't signed yet, so SmartScreen stops it the first time: click “More info”, then “Run anyway”.",
    },
    linux: {
      app: "Download the AppImage",
      appBody:
        "x64. The AppImage is the whole app: make it executable and run it.",
      button: "Download AppImage",
      fuse: "It needs FUSE. On Debian and Ubuntu:",
    },
    after: {
      kicker: "After installing",
      title: "Your first chat in three steps",
      items: [
        {
          title: "Open a project",
          body: "Click + beside Projects and pick a folder already on your computer. Vey Studio works on it where it is.",
          doc: "projects-and-files",
          more: "Projects and files",
        },
        {
          title: "Add your Claude accounts",
          body: "Press + beside Accounts at the bottom of the chats column, once per account.",
          doc: "accounts",
          more: "Claude accounts",
        },
        {
          title: "Start a chat",
          body: "Press + Chat and ask. When an account hits its limit, “Continue with …” carries the chat on.",
          doc: "chats",
          more: "Chats",
        },
      ],
    },
    more: {
      kicker: "More",
      title: "Everything else",
      releases: {
        title: "Every release",
        body: "Older versions and every build, with their notes, on GitHub.",
      },
      update: {
        title: "Updating",
        body: "The app checks for new releases itself. When one is out, a button appears in the status bar: click it and it installs. On Linux it opens the release page instead.",
      },
      trouble: {
        title: "Something not working?",
        body: "claude can't be found, an account won't sign in, a chat seems stuck: the fixes are in the guide.",
      },
    },
  },
}

const vi: Copy = {
  htmlLang: "vi",
  short: "VI",
  title:
    "Vey Studio: chạm giới hạn Claude vẫn làm tiếp, đổi tài khoản ngay giữa cuộc chat",
  description:
    "Ứng dụng desktop cho Claude Code. Thêm mọi tài khoản Claude của bạn; khi một tài khoản chạm giới hạn, chỉ một cú nhấp là cuộc chat tiếp tục trên tài khoản khác, không mất gì. Miễn phí với mọi tài khoản; Pro mua một lần, mở mọi project bạn làm.",
  ogDescription:
    "Chạm giới hạn Claude? Một cú nhấp để tiếp tục cuộc chat trên tài khoản khác.",
  nav: {
    why: "Cách hoạt động",
    features: "Tính năng",
    pricing: "Bảng giá",
    faq: "Hỏi đáp",
    docs: "Hướng dẫn",
    download: "Tải về",
    language: "Ngôn ngữ",
  },
  eyebrow: "Ứng dụng desktop miễn phí cho Claude Code",
  h1: ["Chạm giới hạn Claude?", "Công việc vẫn tiếp tục."],
  lede: "Thêm mọi tài khoản Claude của bạn vào Vey Studio. Khi một tài khoản hết lượt dùng, chỉ một cú nhấp là cuộc chat tiếp tục trên tài khoản khác. Không phải chép lại, không phải giải thích lại.",
  cta: {
    download: "Tải miễn phí",
    downloadFor: "Tải cho ",
    pricing: "Xem bảng giá",
  },
  fine: [
    "macOS · Windows · Linux",
    "miễn phí với mọi tài khoản Claude, Pro một lần cho mọi project",
  ],
  pillars: {
    kicker: "Cách hoạt động",
    title: "Chạm giới hạn không còn phải chờ",
    body: "Các gói Claude giới hạn lượng sử dụng trong mỗi 5 giờ và mỗi tuần. Với Claude Code thông thường, chạm giới hạn là cuộc chat phải dừng đến khi hạn mức reset. Với Vey Studio, chỉ cần một cú nhấp để làm tiếp.",
    items: [
      {
        title: "Thêm mọi tài khoản",
        body: "Công việc, cá nhân, team: mỗi tài khoản đăng nhập một lần. Danh sách dưới các chat cho thấy mỗi tài khoản đã dùng bao nhiêu hạn mức 5 giờ và hằng tuần, để bạn biết tài khoản nào còn dư.",
      },
      {
        title: "Chạm giới hạn? Bấm “Continue”",
        body: "Chat bị dừng sẽ hiện thời điểm hạn mức reset và nút “Continue with …”. Bấm vào là chat chuyển sang tài khoản còn dư và tiếp tục đúng chỗ vừa dừng.",
      },
      {
        title: "Miễn phí với mọi tài khoản",
        body: "Mọi tài khoản, việc chuyển giữa chúng và endpoint API riêng — GLM, Kimi, DeepSeek hay gateway công ty — đều miễn phí. Pro mở thêm project từ project thứ hai, mua một lần, không thuê bao.",
      },
    ],
  },
  features: {
    kicker: "Tính năng",
    title: "Mọi thứ quanh cuộc chat, trong một cửa sổ",
    body: "Xem Claude đang làm gì, kiểm tra những gì nó đã sửa và commit mà không phải đổi qua ứng dụng khác.",
    items: [
      {
        title: "Nhiều chat cùng lúc",
        body: "Chạy nhiều cuộc trò chuyện song song, và thấy ngay chat nào đang chạy, chat nào cần bạn, chat nào đã xong.",
      },
      {
        title: "Git tích hợp sẵn",
        body: "Xem lại mọi thay đổi, commit với message do Claude soạn sẵn, rồi push.",
      },
      {
        title: "Sửa tin nhắn để hoàn tác",
        body: "Sửa một tin nhắn trước đó, và các file Claude đã sửa sau tin nhắn ấy cũng trở về như cũ.",
      },
      {
        title: "Bạn quyết định nó được làm gì",
        body: "Năm chế độ, từ Plan (chỉ đọc và lên kế hoạch) đến Full access. Đổi bất cứ lúc nào, kể cả giữa cuộc chat.",
      },
      {
        title: "Editor và terminal",
        body: "Mở bất kỳ file nào, xem ai sửa từng dòng gần nhất, và chạy lệnh ngay dưới chat.",
      },
      {
        title: "Tìm kiếm mọi thứ",
        body: "Tìm bất kỳ đoạn chữ nào trong mọi file và mọi cuộc chat trước đây.",
      },
    ],
  },
  pricing: {
    kicker: "Bảng giá",
    title: ["Miễn phí, rồi ", "Pro một lần"],
    body: "Mọi tài khoản Claude và endpoint API tuỳ chỉnh đều miễn phí, bao nhiêu cũng được, trong một project. Pro thêm không giới hạn project — mua một lần qua chuyển khoản, không thuê bao.",
    plans: [
      {
        name: "Free",
        price: "0 ₫",
        term: "mãi mãi",
        sub: "Không cần tài khoản",
        items: [
          "Không giới hạn tài khoản Claude — claude.ai, Console, SSO",
          "“Continue with …” sang tài khoản khác khi một tài khoản chạm giới hạn",
          "Endpoint API tuỳ chỉnh — GLM, Kimi, DeepSeek, OpenRouter, gateway công ty",
          "Một project — nhiều chat cùng lúc, git, editor, terminal, tìm kiếm",
          "Mọi bản cập nhật · macOS, Windows, Linux",
        ],
        button: "Tải miễn phí",
      },
      ...devicePlans({
        name: (n) => `${n} thiết bị`,
        term: "một lần",
        sub: (n) => `${n} thiết bị · cập nhật mãi mãi`,
        items: (n) => [
          "Mọi thứ của Free",
          "Không giới hạn project, mỗi project có chat, file và terminal riêng",
          "Worktree, tìm kiếm và tab trên mọi project",
          `${n === 1 ? "Kích hoạt 1 thiết bị" : `${n} thiết bị kích hoạt cùng lúc`} · hoàn tiền trong 7 ngày`,
        ],
        button: (n) => `Mua ${n} thiết bị`,
        flag: "Phổ biến nhất",
      }),
    ],
    pay: "Không tài khoản, không đăng nhập. Chọn gói trong ứng dụng và nhập email; trang VietQR mở trong trình duyệt, Pro bật cho máy đó ngay khi tiền về, và khoá licence được gửi qua email để dùng cho các máy còn lại.",
  },
  steps: {
    kicker: "Bắt đầu",
    title: "Sẵn sàng trong một phút",
    items: [
      {
        title: "Tải về và mở một thư mục",
        body: "Cho macOS, Windows hoặc Linux. Chọn một thư mục dự án đã có sẵn trên máy bạn.",
      },
      {
        title: "Thêm các tài khoản Claude",
        body: "Khi đã cài Claude Code, bấm + cạnh Accounts ở cuối cột chat, mỗi tài khoản một lần.",
      },
      {
        title: "Chat, và cứ thế làm tiếp",
        body: "Giao việc cho Claude. Khi chạm giới hạn, bấm “Continue with …” trên chat là cuộc trò chuyện vẫn tiếp tục.",
      },
    ],
  },
  faq: {
    kicker: "Hỏi đáp",
    title: "Câu hỏi thường gặp",
    items: [
      {
        q: "Vey Studio là gì?",
        a: "Một ứng dụng desktop chạy Claude Code cho bạn, trong một cửa sổ có sẵn dự án, nhiều chat cùng lúc, file, git và terminal. Điểm khác biệt: một cuộc chat có thể chuyển giữa các tài khoản Claude của bạn khi chạm giới hạn sử dụng.",
      },
      {
        q: "Giới hạn 5 giờ là gì?",
        a: "Gói Pro và Max của Claude cho phép dùng Claude Code đến một mức nhất định trong mỗi khoảng 5 giờ, kèm một giới hạn hằng tuần. Khi chạm mức đó, Claude Code dừng lại cho đến khi hạn mức reset. Vey Studio cho thấy mỗi tài khoản của bạn còn lại bao nhiêu.",
      },
      {
        q: "Chuyện gì xảy ra khi tôi chạm giới hạn?",
        a: "Chat dừng lại với một thẻ báo đã chạm giới hạn nào và khi nào reset. “Continue with …” chuyển nó sang tài khoản tiếp theo còn dư và gửi tiếp. Bạn cũng có thể tự chọn tài khoản trong ô soạn tin của chat. Cách nào thì tin nhắn tiếp theo vẫn nhớ mọi điều đã nói.",
      },
      {
        q: "Tôi thêm được bao nhiêu tài khoản Claude?",
        a: "Bao nhiêu cũng được, ngay với bản Free. Mỗi tài khoản đăng nhập một lần và giữ nguyên trạng thái đăng nhập, nên chat nào cũng chạy được trên bất kỳ tài khoản nào.",
      },
      {
        q: "Pro giá bao nhiêu?",
        a: `Từ ${FROM_PRICE} cho một thiết bị — hoặc ba, năm thiết bị — trả một lần qua chuyển khoản. Không thuê bao, không gia hạn; mọi bản cập nhật đều có, licence không bao giờ hết hạn. Không hài lòng? Hoàn tiền trong 7 ngày.`,
      },
      {
        q: "Tôi có cần cài Claude Code không?",
        a: "Có. Ứng dụng chạy chính claude CLI của bạn và đăng nhập từng tài khoản qua nó.",
      },
      {
        q: "Không mua Pro thì dùng được gì?",
        a: "Mọi thứ với tài khoản Claude, trong một project: thêm bao nhiêu tài khoản cũng được, chuyển chat giữa chúng, mọi panel của ứng dụng. Cả endpoint API tuỳ chỉnh. Chỉ project thứ hai mới cần Pro.",
      },
      {
        q: "Dùng Pro trên máy khác được không?",
        a: "Được, tối đa số thiết bị của gói. Dán khoá licence trong email vào hộp thoại Vey Pro trên máy kia. Đổi máy mới? Huỷ kích hoạt máy cũ trong cùng hộp thoại để trả lại suất.",
      },
      {
        q: "Yêu cầu của tôi được gửi đi đâu?",
        a: "Đi thẳng từ ứng dụng đến Anthropic bằng tài khoản của bạn, hoặc đến endpoint bạn tự cấu hình. Server này chỉ tham gia khi bạn mua Pro.",
      },
      {
        q: "Thanh toán thế nào?",
        a: "Chuyển khoản ngân hàng qua VietQR, ngay trong ứng dụng. Pro bật ngay khi tiền về, và ứng dụng sẽ thông báo cho bạn.",
      },
      {
        q: "Chạy được trên nền tảng nào?",
        a: "macOS 12 trở lên, chip Apple Silicon hoặc Intel; Windows và Linux bản x64. Ứng dụng tự cập nhật khi có bản mới.",
      },
    ],
  },
  closing: ["Giới hạn không phải ", "là điểm dừng."],
  windowCaption: "Một cuộc trò chuyện, tài khoản nào cũng được.",
  footer: {
    download: "Tải về",
    product: "Sản phẩm",
    tagline: "Studio desktop cho Claude Code.",
  },
  install: {
    title: "Cài Vey Studio cho macOS, Windows hoặc Linux",
    description:
      "Tải Vey Studio, ứng dụng desktop miễn phí cho Claude Code, cho macOS, Windows hoặc Linux.",
    eyebrow: "Ứng dụng desktop miễn phí cho Claude Code",
    h1: ["Cài đặt", "Vey Studio."],
    lede: "Tải ứng dụng cho máy của bạn, rồi thêm các tài khoản Claude và bắt đầu chat.",
    platform: "Nền tảng",
    version: (v) => `Mới nhất: v${v}`,
    copy: "Chép",
    copied: "Đã chép",
    mac: {
      app: "Tải file .dmg",
      appBody:
        "Mở file và kéo Vey Studio vào Applications. Sau đó chạy lệnh này một lần, nếu không macOS sẽ báo ứng dụng bị hỏng:",
      why: "Vey Studio chưa được ký bằng chứng chỉ của Apple, nên macOS cách ly file .dmg tải bằng trình duyệt và báo ứng dụng “bị hỏng”. Lệnh trên gỡ việc cách ly đó.",
      arm64: "Apple Silicon",
      x64: "Intel",
    },
    windows: {
      app: "Tải bộ cài",
      appBody: "Bản x64. Chạy file .exe; nó cài ứng dụng rồi mở lên.",
      button: "Tải cho Windows",
      smartScreen:
        "Bộ cài chưa được ký, nên lần đầu SmartScreen sẽ chặn: bấm “More info”, rồi “Run anyway”.",
    },
    linux: {
      app: "Tải AppImage",
      appBody:
        "Bản x64. AppImage là toàn bộ ứng dụng: cấp quyền chạy rồi mở nó.",
      button: "Tải AppImage",
      fuse: "Cần có FUSE. Trên Debian và Ubuntu:",
    },
    after: {
      kicker: "Sau khi cài",
      title: "Cuộc chat đầu tiên trong ba bước",
      items: [
        {
          title: "Mở một project",
          body: "Bấm + cạnh Projects và chọn một thư mục đã có trên máy. Vey Studio làm việc ngay tại chỗ, không sao chép nó.",
          doc: "projects-and-files",
          more: "Project và file",
        },
        {
          title: "Thêm các tài khoản Claude",
          body: "Bấm + cạnh Accounts ở cuối cột chat, mỗi tài khoản một lần.",
          doc: "accounts",
          more: "Tài khoản Claude",
        },
        {
          title: "Bắt đầu chat",
          body: "Bấm + Chat và đặt câu hỏi. Khi một tài khoản chạm giới hạn, “Continue with …” giúp cuộc chat làm tiếp.",
          doc: "chats",
          more: "Chat",
        },
      ],
    },
    more: {
      kicker: "Thêm",
      title: "Những thứ khác",
      releases: {
        title: "Mọi phiên bản",
        body: "Các phiên bản cũ và mọi bản build, kèm ghi chú, trên GitHub.",
      },
      update: {
        title: "Cập nhật",
        body: "Ứng dụng tự kiểm tra bản mới. Khi có, một nút hiện ở thanh trạng thái: bấm vào là nó tự cài. Trên Linux, nút này mở trang phát hành.",
      },
      trouble: {
        title: "Gặp trục trặc?",
        body: "Không tìm thấy claude, tài khoản không đăng nhập được, chat có vẻ bị treo: cách xử lý có trong hướng dẫn.",
      },
    },
  },
}

export const COPY: Record<Lang, Copy> = { en, vi }
