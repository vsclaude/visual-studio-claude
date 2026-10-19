/**
 * Every word of the home page, in each language it is written in.
 *
 * English is the default (`/`), Vietnamese is `/?lang=vi`: a URL each rather
 * than a script swapping text, so the page arrives in its language with
 * nothing to flicker and a search engine can read both.
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

/** The language a request asked for, or English. */
export function langOf(value: unknown): Lang {
  return value === "vi" ? "vi" : "en"
}

/** Where a language's page lives. English keeps the bare root. */
export function pathOf(lang: Lang): string {
  return lang === "en" ? "/" : `/?lang=${lang}`
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
    download: string
    language: string
  }
  eyebrow: string
  /** The second half is the accent — set in serif italic. */
  h1: [plain: string, accent: string]
  lede: string
  cta: { download: string; downloadFor: string; pricing: string }
  fine: string
  /** The three problems — in the order of `PILLAR_ORDER` in `landing.ts`. */
  pillars: Section
  /** The studio around them — in the order of `FEATURE_ORDER`. */
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
  /** The strip naming what the studio runs — words only, no one else's logo. */
  worksWith: string
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
    download: "Download",
    language: "Language",
  },
  eyebrow: "Out of your 5-hour window? Keep going.",
  h1: ["Hit your Claude limit?", "Keep working anyway."],
  lede: "VS Claude is the desktop studio for Claude Code that keeps your work moving. Sign in to every Claude account you have and move a chat between them mid-conversation — it picks up exactly where it stopped. When every plan is out of its 5-hour window, carry on with credits.",
  cta: {
    download: "Download for free",
    downloadFor: "Download for ",
    pricing: "See pricing",
  },
  fine: "macOS · Windows · Linux &nbsp;—&nbsp; free with your own Claude accounts, credits when you need them",
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
        body: "When every plan is out of its window, switch the chat to credits and keep going on Haiku, Sonnet or Opus. Pay once, no subscription — credits never expire.",
      },
    ],
  },
  features: {
    kicker: "Features",
    title: "And a studio to do the work in",
    body: "Everything a conversation touches is one click from it — so you read what it did instead of hunting for it.",
    items: [
      {
        title: "Many chats, side by side",
        body: "Run several conversations at once. Each keeps its own Claude session open, so a message sent mid-answer is queued, not lost.",
      },
      {
        title: "See exactly what changed",
        body: "Every edit lands in a Git view — changes, diffs, commits and push — with a commit message drafted from the staged diff when you want one.",
      },
      {
        title: "Worktrees as projects",
        body: "Cut a git worktree from a project's row and give each chat its own branch. An unnamed branch takes its name from the chat's title.",
      },
      {
        title: "You decide what it may touch",
        body: "Five modes per chat — Plan, Read only, Ask, Edits, Full access — switched mid-conversation without throwing away the prompt cache.",
      },
      {
        title: "A real editor and terminal",
        body: "Files open in a full editor with blame and conflict resolution, shells live in a dock under the chat, and search reaches every file and every chat.",
      },
      {
        title: "See your limits coming",
        body: "The composer shows how much of the 5-hour and 7-day windows the chat's account has used — or the credits left — so a switch is a decision, not a surprise.",
      },
    ],
  },
  pricing: {
    kicker: "Pricing",
    title: ["Pay with ", "credits"],
    body: "The app is free. Out of your 5-hour window, or no Claude subscription at all? Buy a pack once and use it on Haiku, Sonnet or Opus — it never expires.",
    popular: "Most popular",
    credits: "credits",
    bonus: (percent) => `+${percent}% bonus`,
    starter: "Starter",
    note: "once · never expires",
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
        q: "Which models can I use?",
        a: "Haiku, Sonnet and Opus. Each spends credits at its own price — Sonnet 20× and Opus 40× Haiku — so a credit is worth the same money on every model.",
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
  worksWith: "Works with",
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
    download: "Tải về",
    language: "Ngôn ngữ",
  },
  eyebrow: "Hết hạn mức 5 giờ? Cứ làm tiếp.",
  h1: ["Chạm giới hạn Claude?", "Công việc vẫn tiếp tục."],
  lede: "VS Claude là studio desktop cho Claude Code giúp công việc của bạn không bị dừng lại. Đăng nhập mọi tài khoản Claude bạn có và chuyển một cuộc chat giữa chúng ngay giữa chừng — nó tiếp tục đúng chỗ vừa dừng. Khi mọi gói đều hết hạn mức 5 giờ, làm tiếp bằng credit.",
  cta: {
    download: "Tải miễn phí",
    downloadFor: "Tải cho ",
    pricing: "Xem bảng giá",
  },
  fine: "macOS · Windows · Linux &nbsp;—&nbsp; miễn phí với tài khoản Claude của bạn, credit khi bạn cần",
  pillars: {
    kicker: "Vì sao chọn VS Claude",
    title: "Để giới hạn không bao giờ chặn ngang công việc",
    body: "Claude Code thuần gắn mỗi cuộc chat với một tài khoản và dừng nó khi tài khoản đó chạm giới hạn. VS Claude gỡ bỏ cả hai điều đó.",
    items: [
      {
        title: "Mọi tài khoản Claude, một menu",
        body: "Thêm tài khoản công việc, cá nhân, của team một lần — mỗi tài khoản đăng nhập bằng chính lệnh login của CLI, trong thư mục riêng. Mỗi chat tự chọn tài khoản để chạy.",
      },
      {
        title: "Đổi tài khoản giữa chừng, không mất gì",
        body: "Chuyển cuộc chat sang tài khoản khác từ menu Account của nó. Phiên làm việc đi theo, nên tin nhắn tiếp theo vẫn có đủ ngữ cảnh — không phải dán lại, không phải làm lại từ đầu.",
      },
      {
        title: "Vượt giới hạn 5 giờ bằng credit",
        body: "Khi mọi gói đều hết hạn mức, chuyển chat sang credit và làm tiếp với Haiku, Sonnet hay Opus. Trả một lần, không thuê bao — credit không bao giờ hết hạn.",
      },
    ],
  },
  features: {
    kicker: "Tính năng",
    title: "Và một studio để làm việc",
    body: "Mọi thứ một cuộc chat chạm tới đều cách nó đúng một cú nhấp — bạn đọc được nó đã làm gì, thay vì phải đi tìm.",
    items: [
      {
        title: "Nhiều chat song song",
        body: "Chạy nhiều cuộc trò chuyện cùng lúc. Mỗi chat giữ phiên Claude của riêng nó, nên tin nhắn gửi khi Claude đang trả lời sẽ được xếp hàng, không bị mất.",
      },
      {
        title: "Thấy rõ đã thay đổi gì",
        body: "Mọi chỉnh sửa đều hiện trong tab Git — thay đổi, diff, commit và push — kèm commit message soạn sẵn từ phần đã stage khi bạn cần.",
      },
      {
        title: "Mỗi worktree là một project",
        body: "Tạo git worktree ngay từ dòng của project và cho mỗi chat một nhánh riêng. Nhánh chưa đặt tên sẽ tự lấy tên theo tiêu đề của chat.",
      },
      {
        title: "Bạn quyết định nó được chạm vào đâu",
        body: "Năm chế độ cho mỗi chat — Plan, Read only, Ask, Edits, Full access — đổi ngay giữa cuộc trò chuyện mà không làm mất prompt cache.",
      },
      {
        title: "Editor và terminal thực thụ",
        body: "File mở trong một editor đầy đủ, có blame và xử lý conflict; terminal nằm ngay dưới chat; tìm kiếm được trong mọi file và mọi cuộc chat.",
      },
      {
        title: "Thấy trước khi sắp chạm giới hạn",
        body: "Composer hiển thị tài khoản của chat đã dùng bao nhiêu hạn mức 5 giờ và 7 ngày — hoặc còn bao nhiêu credit — để việc đổi tài khoản là một lựa chọn, không phải một bất ngờ.",
      },
    ],
  },
  pricing: {
    kicker: "Bảng giá",
    title: ["Trả bằng ", "credit"],
    body: "Ứng dụng miễn phí. Hết hạn mức 5 giờ, hay chưa có gói Claude nào? Mua một gói credit một lần, dùng cho Haiku, Sonnet hay Opus — không bao giờ hết hạn.",
    popular: "Phổ biến nhất",
    credits: "credit",
    bonus: (percent) => `+${percent}% thưởng thêm`,
    starter: "Khởi đầu",
    note: "trả một lần · không hết hạn",
    pay: "Thanh toán bằng chuyển khoản VietQR hoặc thẻ quốc tế. Credit chỉ dùng khi tài khoản của bạn đã hết hạn mức — dùng tài khoản của bạn thì vẫn miễn phí.",
  },
  steps: {
    kicker: "Bắt đầu",
    title: "Sẵn sàng trong một phút",
    items: [
      {
        title: "Tải ứng dụng",
        body: "Cho macOS, Windows hoặc Linux. Trỏ nó tới một thư mục có sẵn trên máy bạn.",
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
        a: "Chuyển chat sang một tài khoản khác của bạn, hoặc sang credit, từ menu Account của nó. Cuộc trò chuyện đi theo: tin nhắn tiếp theo vẫn nhớ mọi thứ đã nói.",
      },
      {
        q: "Tôi thêm được bao nhiêu tài khoản Claude?",
        a: "Bao nhiêu cũng được. Mỗi tài khoản đăng nhập một lần, trong thư mục riêng, và giữ nguyên trạng thái đăng nhập — chat nào cũng chạy được trên bất kỳ tài khoản nào.",
      },
      {
        q: "Tôi có cần gói Claude không?",
        a: "Không. Với credit, studio chạy mọi chat mà không cần tài khoản Claude riêng. Nếu bạn có tài khoản, studio dùng thẳng chúng và bạn không tốn credit nào.",
      },
      {
        q: "Credit có hết hạn không?",
        a: "Không bao giờ. Gói được mua một lần và nằm trong tài khoản cho đến khi dùng hết — không có phí hàng tháng.",
      },
      {
        q: "Tôi dùng được những model nào?",
        a: "Haiku, Sonnet và Opus. Mỗi model tiêu credit theo giá riêng — Sonnet gấp 20 lần và Opus gấp 40 lần Haiku — nên một credit có cùng giá trị tiền trên mọi model.",
      },
      {
        q: "Request của tôi đi đâu?",
        a: "Khi dùng credit, request đi qua server này tới Anthropic, đó là cách chúng được tính phí; token đăng nhập của bạn không bao giờ được chuyển tiếp. Khi dùng tài khoản của bạn, request đi thẳng từ ứng dụng tới Anthropic — server này không tham gia.",
      },
      {
        q: "Thanh toán thế nào?",
        a: "Chuyển khoản ngân hàng qua VietQR, hoặc thẻ quốc tế. Credit được cộng ngay khi tiền về, và ứng dụng sẽ báo cho bạn.",
      },
      {
        q: "Hỗ trợ những nền tảng nào?",
        a: "macOS, Windows và Linux. Ứng dụng tự cập nhật khi có bản mới.",
      },
    ],
  },
  closing: ["Giới hạn không phải ", "là điểm dừng."],
  windowCaption: "Một cuộc trò chuyện, tài khoản nào cũng được.",
  worksWith: "Hoạt động với",
  footer: {
    releases: "Bản phát hành",
    product: "Sản phẩm",
    tagline: "Studio desktop cho Claude Code.",
  },
}

export const COPY: Record<Lang, Copy> = { en, vi }
