/**
 * Every word of the home page, in each language it is written in.
 *
 * English is the default (`/`), Vietnamese is `/vi/` — VitePress's locales,
 * one page each rather than a script swapping text, so the page arrives in
 * its language with nothing to flicker and a search engine can read both. It
 * was `/?lang=vi` while the Worker drew the page; `config.ts` sends that on.
 *
 * **The page leads with the three problems VS Claude exists for**: many Claude
 * accounts, one menu; a conversation that survives the switch between them;
 * and credits past the plan's 5-hour limit. Running chats side by side and
 * reading their diffs is the studio around that, and comes second. What the
 * page promises is what the app does — a switch is the user's, made in a
 * chat's Account menu (nothing switches by itself), and the conversation
 * carries because `carryTranscript` in the app's `src/main/chat.ts` moves the
 * CLI's transcript to the new account's directory.
 *
 * What stays English on purpose is the app's own vocabulary — the studio's UI
 * is English, so "Pay with credits", "Account" and the mode names are written
 * as the reader will find them on screen. The picture of the app in the hero
 * and the text inside the illustrations stay English for the same reason.
 *
 * Every language has the same shape (`Copy`), so a missing sentence is a type
 * error rather than a blank on the page.
 */

export type Lang = "en" | "vi"

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
  fine: string
  /** The three problems — in the order of `PILLAR_ORDER` in `home/demo.ts`. */
  pillars: Section
  /** The studio's main parts — in the order of `FEATURE_ORDER`. */
  features: Section
  pricing: {
    kicker: string
    title: [plain: string, accent: string]
    body: string
    popular: string
    credits: string
    bonus: (percent: number) => string
    starter: string
    note: string
    /** The note on a pack sold by bank transfer alone (`bankOnly`). */
    bankOnly: string
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
  footer: { releases: string; product: string; tagline: string }
}

const en: Copy = {
  htmlLang: "en",
  short: "EN",
  title:
    "VS Claude — switch Claude accounts mid-chat, keep working past the 5-hour limit",
  description:
    "The desktop studio for Claude Code. Sign in to all your Claude accounts, move a conversation between them without losing it, and keep going on credits when every plan is out of its 5-hour window.",
  ogDescription:
    "Switch Claude accounts mid-chat. Keep working past the 5-hour limit.",
  nav: {
    why: "Why",
    features: "Features",
    pricing: "Pricing",
    faq: "FAQ",
    docs: "Docs",
    download: "Download",
    language: "Language",
  },
  eyebrow: "Out of your 5-hour window? Keep going.",
  h1: ["Hit your Claude limit?", "Keep working anyway."],
  lede: "Move a chat to another of your Claude accounts, or to credits when every plan is out of its 5-hour window. It picks up exactly where it stopped.",
  cta: {
    download: "Download for free",
    downloadFor: "Download for ",
    pricing: "See pricing",
  },
  fine: "macOS · Windows · Linux \u00a0—\u00a0 free with your own Claude accounts, credits when you need them",
  pillars: {
    kicker: "Why VS Claude",
    title: "Built so a limit never ends your work",
    body: "Plain Claude Code ties a conversation to one login and stops it at that login's limit. VS Claude takes both away.",
    items: [
      {
        title: "Every Claude account, one menu",
        body: "Add your work, personal and team accounts once — each signs in through the CLI's own login, in a directory of its own. Every chat picks the account it runs on.",
      },
      {
        title: "Switch mid-chat, lose nothing",
        body: "Move a conversation to another account from its Account menu. The session comes with it, so the next message carries on with the full context — no pasting, no starting over.",
      },
      {
        title: "Past the 5-hour limit, on credits",
        body: "When every plan is out of its window, switch the chat to credits and keep going. Pay once, no subscription — credits never expire.",
      },
    ],
  },
  features: {
    kicker: "Features",
    title: "And a studio to do the work in",
    body: "Everything a conversation touches is one click from it — so you read what it did instead of hunting for it.",
    items: [
      {
        title: "Chats side by side",
        body: "Several conversations at once, each with its own Claude session.",
      },
      {
        title: "Git, built in",
        body: "Changes, diffs, commits and push, with a commit message drafted for you.",
      },
      {
        title: "Worktrees as projects",
        body: "A git worktree per chat, cut from the project's row.",
      },
      {
        title: "Five permission modes",
        body: "Plan, Read only, Ask, Edits, Full access — switched mid-chat.",
      },
      {
        title: "Editor and terminal",
        body: "A full editor with blame, and shells right under the chat.",
      },
      {
        title: "Search everything",
        body: "One query across every file and every chat you have had.",
      },
    ],
  },
  pricing: {
    kicker: "Pricing",
    title: ["Pay with ", "credits"],
    body: "The app is free. Out of your 5-hour window, or no Claude subscription at all? Buy a pack once — it never expires.",
    popular: "Most popular",
    credits: "in credits",
    bonus: (percent) => `+${percent}% bonus`,
    starter: "Starter",
    note: "once · never expires",
    bankOnly: "VietQR transfer only · never expires",
    pay: "Pay by VietQR bank transfer or international card. Credits are only for when your own accounts run out — your logins stay free.",
  },
  steps: {
    kicker: "Get started",
    title: "Up and running in a minute",
    items: [
      {
        title: "Download the app",
        body: "For macOS, Windows or Linux. Point it at a folder already on your machine.",
      },
      {
        title: "Add your Claude accounts",
        body: "Settings › Claude › Add account, once for each. Every one signs in through the CLI's own login.",
      },
      {
        title: "Switch when a limit hits",
        body: "Pick another account in the chat's Account menu — or “Pay with credits”, after signing in with Google. The conversation carries on.",
      },
    ],
  },
  faq: {
    kicker: "FAQ",
    title: "Questions, answered",
    items: [
      {
        q: "What happens when I hit the 5-hour limit?",
        a: "Switch the chat to another of your accounts, or to credits, from its Account menu. The conversation moves with it: the next message carries on with everything said so far.",
      },
      {
        q: "How many Claude accounts can I add?",
        a: "As many as you have. Each signs in once, in a directory of its own, and stays signed in — any chat can run on any of them.",
      },
      {
        q: "Do I need a Claude subscription?",
        a: "No. With credits, the studio runs every chat without a Claude account of your own. If you have accounts, it uses them directly and credits cost you nothing.",
      },
      {
        q: "Do credits expire?",
        a: "Never. A pack is bought once and stays on your account until it is spent — there is no monthly fee.",
      },
      {
        q: "How far does a pack go?",
        a: "Every reply on credits ends with what it took off your balance, in dollars, so you never have to guess. As a rough guide, one call to Sonnet with a mostly cached prompt is around $0.01–0.015, and a Claude Code message makes a few of them. Haiku costs a twentieth of that and Opus twice as much.",
      },
      {
        q: "Where do my requests go?",
        a: "On credits, through this server to Anthropic, which is how they are charged; your sign-in token is never passed on. On your own accounts, straight from the app to Anthropic — this server is not involved.",
      },
      {
        q: "How do I pay?",
        a: "By bank transfer with VietQR, or by international card. Credits arrive as soon as the payment does, and the app tells you when.",
      },
      {
        q: "Which platforms?",
        a: "macOS, Windows and Linux. The app updates itself when a new release is out.",
      },
    ],
  },
  closing: ["Your limit isn't ", "your deadline."],
  windowCaption: "One conversation, any account.",
  footer: {
    releases: "Releases",
    product: "Product",
    tagline: "The desktop studio for Claude Code.",
  },
}

const vi: Copy = {
  htmlLang: "vi",
  short: "VI",
  title:
    "VS Claude — đổi tài khoản Claude giữa cuộc chat, làm tiếp khi đã chạm giới hạn 5 giờ",
  description:
    "Studio desktop cho Claude Code. Đăng nhập mọi tài khoản Claude của bạn, chuyển một cuộc chat sang tài khoản khác mà không mất ngữ cảnh, và làm tiếp bằng credit khi mọi gói đều đã hết hạn mức 5 giờ.",
  ogDescription:
    "Đổi tài khoản Claude giữa cuộc chat. Làm tiếp khi đã chạm giới hạn 5 giờ.",
  nav: {
    why: "Vì sao",
    features: "Tính năng",
    pricing: "Bảng giá",
    faq: "Hỏi đáp",
    docs: "Hướng dẫn",
    download: "Tải về",
    language: "Ngôn ngữ",
  },
  eyebrow: "Hết hạn mức 5 giờ? Cứ làm tiếp.",
  h1: ["Chạm giới hạn Claude?", "Công việc vẫn tiếp tục."],
  lede: "Chuyển cuộc chat sang tài khoản Claude khác, hoặc sang credit khi mọi gói đều hết hạn mức 5 giờ. Cuộc chat tiếp tục đúng chỗ nó vừa dừng.",
  cta: {
    download: "Tải miễn phí",
    downloadFor: "Tải cho ",
    pricing: "Xem bảng giá",
  },
  fine: "macOS · Windows · Linux \u00a0—\u00a0 miễn phí với tài khoản Claude của bạn, credit khi bạn cần",
  pillars: {
    kicker: "Vì sao chọn VS Claude",
    title: "Giới hạn không bao giờ làm gián đoạn công việc",
    body: "Claude Code gốc gắn mỗi cuộc chat với một tài khoản và dừng lại khi tài khoản đó chạm giới hạn. VS Claude loại bỏ cả hai ràng buộc đó.",
    items: [
      {
        title: "Mọi tài khoản Claude, một menu",
        body: "Thêm tài khoản công việc, cá nhân và team, mỗi tài khoản một lần. Mỗi tài khoản đăng nhập bằng lệnh login của CLI trong thư mục riêng. Mỗi chat chọn tài khoản nó sẽ chạy.",
      },
      {
        title: "Đổi tài khoản giữa chừng, không mất gì",
        body: "Chuyển cuộc chat sang tài khoản khác từ menu Account của nó. Phiên làm việc đi theo, nên tin nhắn tiếp theo vẫn có đủ ngữ cảnh — không phải dán lại, không phải làm lại từ đầu.",
      },
      {
        title: "Vượt giới hạn 5 giờ bằng credit",
        body: "Khi mọi gói đều hết hạn mức, chuyển chat sang credit và làm tiếp. Trả một lần, không đăng ký gói hàng tháng. Credit không bao giờ hết hạn.",
      },
    ],
  },
  features: {
    kicker: "Tính năng",
    title: "Và một studio để làm việc",
    body: "Mọi thứ mà cuộc chat tác động đến đều chỉ cách một cú nhấp, để bạn xem nó đã làm gì thay vì phải đi tìm.",
    items: [
      {
        title: "Chat song song",
        body: "Nhiều cuộc trò chuyện cùng lúc, mỗi cuộc một phiên Claude riêng.",
      },
      {
        title: "Git tích hợp sẵn",
        body: "Thay đổi, diff, commit và push, có sẵn commit message soạn trước.",
      },
      {
        title: "Mỗi worktree là một project",
        body: "Mỗi chat một git worktree, tạo ngay từ hàng của project.",
      },
      {
        title: "Năm chế độ quyền",
        body: "Plan, Read only, Ask, Edits, Full access — đổi ngay giữa cuộc chat.",
      },
      {
        title: "Editor và terminal",
        body: "Editor đầy đủ có blame, terminal nằm ngay dưới chat.",
      },
      {
        title: "Tìm kiếm mọi thứ",
        body: "Một lần tìm trên mọi file và mọi cuộc chat.",
      },
    ],
  },
  pricing: {
    kicker: "Bảng giá",
    title: ["Trả bằng ", "credit"],
    body: "Ứng dụng miễn phí. Hết hạn mức 5 giờ, hoặc chưa có gói Claude nào? Mua credit một lần. Credit không bao giờ hết hạn.",
    popular: "Phổ biến nhất",
    credits: "credit",
    bonus: (percent) => `tặng thêm ${percent}%`,
    starter: "Khởi đầu",
    note: "trả một lần · không hết hạn",
    bankOnly: "chỉ chuyển khoản VietQR · không hết hạn",
    pay: "Thanh toán qua chuyển khoản VietQR hoặc thẻ quốc tế. Credit chỉ dùng khi tài khoản của bạn đã hết hạn mức; dùng tài khoản riêng thì vẫn miễn phí.",
  },
  steps: {
    kicker: "Bắt đầu",
    title: "Sẵn sàng trong một phút",
    items: [
      {
        title: "Tải ứng dụng",
        body: "Cho macOS, Windows hoặc Linux. Chọn một thư mục đã có sẵn trên máy bạn.",
      },
      {
        title: "Thêm các tài khoản Claude",
        body: "Settings › Claude › Add account, mỗi tài khoản một lần. Tài khoản nào cũng đăng nhập bằng chính lệnh login của CLI.",
      },
      {
        title: "Đổi khi chạm giới hạn",
        body: "Chọn tài khoản khác trong menu Account của chat — hoặc “Pay with credits”, sau khi đăng nhập bằng Google. Cuộc trò chuyện vẫn tiếp tục.",
      },
    ],
  },
  faq: {
    kicker: "Hỏi đáp",
    title: "Câu hỏi thường gặp",
    items: [
      {
        q: "Chuyện gì xảy ra khi tôi chạm giới hạn 5 giờ?",
        a: "Chuyển chat sang một tài khoản khác của bạn, hoặc sang credit, từ menu Account của nó. Cuộc trò chuyện được giữ nguyên: tin nhắn tiếp theo vẫn nhớ mọi điều đã nói.",
      },
      {
        q: "Tôi thêm được bao nhiêu tài khoản Claude?",
        a: "Bao nhiêu cũng được. Mỗi tài khoản đăng nhập một lần, trong thư mục riêng, và giữ nguyên trạng thái đăng nhập — chat nào cũng chạy được trên bất kỳ tài khoản nào.",
      },
      {
        q: "Tôi có cần gói Claude không?",
        a: "Không. Với credit, studio chạy mọi chat mà không cần tài khoản Claude riêng. Nếu bạn có tài khoản, studio dùng chính tài khoản đó và bạn không tốn credit.",
      },
      {
        q: "Credit có hết hạn không?",
        a: "Không. Bạn mua một lần, credit nằm trong tài khoản cho đến khi dùng hết, và không có phí hàng tháng.",
      },
      {
        q: "Một gói dùng được bao lâu?",
        a: "Mỗi câu trả lời chạy bằng credit đều ghi rõ đã trừ bao nhiêu đô la, nên bạn không phải đoán. Ước chừng, một lần gọi Sonnet với prompt phần lớn đã cache tốn khoảng $0,01–0,015, và một tin nhắn Claude Code thường gọi vài lần như vậy. Haiku chỉ tốn một phần hai mươi, Opus gấp đôi.",
      },
      {
        q: "Yêu cầu của tôi được gửi đi đâu?",
        a: "Khi dùng credit, yêu cầu đi qua server này đến Anthropic, và đó là cách chúng được tính phí. Token đăng nhập của bạn không bao giờ được chuyển tiếp. Khi dùng tài khoản riêng, yêu cầu đi thẳng từ ứng dụng đến Anthropic, không qua server này.",
      },
      {
        q: "Thanh toán thế nào?",
        a: "Chuyển khoản ngân hàng qua VietQR, hoặc thẻ quốc tế. Credit được cộng ngay khi thanh toán hoàn tất, và ứng dụng sẽ thông báo cho bạn.",
      },
      {
        q: "Chạy được trên nền tảng nào?",
        a: "macOS, Windows và Linux. Ứng dụng tự cập nhật khi có bản mới.",
      },
    ],
  },
  closing: ["Giới hạn không phải ", "là điểm dừng."],
  windowCaption: "Một cuộc trò chuyện, tài khoản nào cũng được.",
  footer: {
    releases: "Bản phát hành",
    product: "Sản phẩm",
    tagline: "Studio desktop cho Claude Code.",
  },
}

export const COPY: Record<Lang, Copy> = { en, vi }
