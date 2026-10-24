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
 * fall back on credits when every account is spent. Running chats side by
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
  /** Under the buttons: the platforms, linking to the guide's downloads —
   * every build, for whoever the button's guess was wrong for — then the
   * rest of the line. */
  fine: [platforms: string, rest: string]
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
    /** The payment toggle's two labels, as the studio's dialog has them. */
    methods: { bank: string; card: string }
    /** The pack's button — drawn as the dialog draws it, and inert: buying
     * happens in the app, signed in. */
    buy: string
    /** The line under the packs, for the method chosen. */
    pay: { bank: string; card: string }
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
}

const en: Copy = {
  htmlLang: "en",
  short: "EN",
  title:
    "Vey Studio: hit your Claude limit, keep working by switching accounts mid-chat",
  description:
    "A free desktop app for Claude Code. Add all your Claude accounts; when one hits its usage limit, continue the same chat on another account or on credits, with one click and nothing lost.",
  ogDescription:
    "Hit your Claude limit? Continue the same chat on another account, or on credits, in one click.",
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
  lede: "Add all your Claude accounts to Vey Studio. When one runs out, continue the same chat on another account or on credits in one click. Nothing to copy, nothing to explain again.",
  cta: {
    download: "Download for free",
    downloadFor: "Download for ",
    pricing: "See pricing",
  },
  fine: [
    "macOS · Windows · Linux",
    "free with your own Claude accounts, credits only if you need them",
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
        title: "Every account used up? Use credits",
        body: "Switch the chat to “Pay with credits” and keep going. This also works with no Claude plan at all. Pay as you go: no subscription, and credits never expire.",
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
    title: ["Pay with ", "credits"],
    body: "The app is free, and so is using it with your own Claude accounts. Credits are only for when you run out or have no Claude plan. Buy a pack once; it never expires.",
    popular: "Most popular",
    credits: "in credits",
    bonus: (percent) => `+${percent}% bonus`,
    methods: {
      bank: "Vietnamese bank · VietQR",
      card: "Card · international",
    },
    buy: "Buy credits",
    pay: {
      bank: "A page with the VietQR opens in your browser. Scan it in your banking app. Credits never expire.",
      card: "Checkout opens in your browser and is handled by Paddle. Credits never expire.",
    },
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
        body: "With Claude Code installed, press + beside Accounts at the bottom of the chats column, once for each account. No account? Sign in with Google and use credits.",
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
        a: "A free desktop app that runs Claude Code for you, in a window with your projects, several chats at once, your files, git and a terminal. What sets it apart: a chat can move between your Claude accounts, or onto credits, when a usage limit hits.",
      },
      {
        q: "What is the 5-hour limit?",
        a: "Claude's Pro and Max plans let you use Claude Code up to a set amount in every 5-hour period, plus a weekly cap. Once you reach it, Claude Code stops until the limit resets. Vey Studio shows how much each of your accounts has left.",
      },
      {
        q: "What happens when I hit a limit?",
        a: "The chat stops on a card saying which limit it hit and when it resets. “Continue with …” moves it to your next account with room (credits last) and sends it on. You can also pick an account yourself in the chat's composer. Either way the next message remembers everything said so far.",
      },
      {
        q: "How many Claude accounts can I add?",
        a: "As many as you have. Each signs in once and stays signed in, so any chat can run on any of them.",
      },
      {
        q: "Do I need a Claude subscription?",
        a: "No. With credits, the app runs every chat without a Claude account of your own. If you do have accounts, it uses them directly and costs you nothing.",
      },
      {
        q: "Do I need Claude Code installed?",
        a: "For your own Claude accounts, yes. The app runs your own claude CLI and signs each account in through it. To chat on credits alone, no.",
      },
      {
        q: "Do credits expire?",
        a: "Never. A pack is bought once and stays on your account until it is spent. There is no monthly fee.",
      },
      {
        q: "How far does a pack go?",
        a: "Every reply on credits shows what it cost, in dollars, so you never have to guess. As a rough guide, one call to Sonnet with a mostly cached prompt is around $0.01–0.015, and a Claude Code message makes a few of them. Haiku costs a twentieth of that and Opus twice as much.",
      },
      {
        q: "Where do my requests go?",
        a: "On credits, through this server to Anthropic, which is how they are charged; your sign-in token is never passed on. On your own accounts, straight from the app to Anthropic, without this server.",
      },
      {
        q: "How do I pay?",
        a: "By bank transfer with VietQR, or by international card. Credits arrive as soon as the payment does, and the app tells you when.",
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
}

const vi: Copy = {
  htmlLang: "vi",
  short: "VI",
  title:
    "Vey Studio: chạm giới hạn Claude vẫn làm tiếp, đổi tài khoản ngay giữa cuộc chat",
  description:
    "Ứng dụng desktop miễn phí cho Claude Code. Thêm mọi tài khoản Claude của bạn; khi một tài khoản chạm giới hạn, chỉ một cú nhấp là cuộc chat tiếp tục trên tài khoản khác hoặc bằng credit, không mất gì.",
  ogDescription:
    "Chạm giới hạn Claude? Một cú nhấp để tiếp tục cuộc chat trên tài khoản khác, hoặc bằng credit.",
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
  lede: "Thêm mọi tài khoản Claude của bạn vào Vey Studio. Khi một tài khoản hết lượt dùng, chỉ một cú nhấp là cuộc chat tiếp tục trên tài khoản khác hoặc bằng credit. Không phải chép lại, không phải giải thích lại.",
  cta: {
    download: "Tải miễn phí",
    downloadFor: "Tải cho ",
    pricing: "Xem bảng giá",
  },
  fine: [
    "macOS · Windows · Linux",
    "miễn phí với tài khoản Claude của bạn, credit chỉ khi cần",
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
        title: "Hết sạch tài khoản? Dùng credit",
        body: "Chuyển chat sang “Pay with credits” và làm tiếp, kể cả khi bạn không có gói Claude nào. Dùng bao nhiêu trả bấy nhiêu: không đăng ký hàng tháng, credit không bao giờ hết hạn.",
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
    title: ["Trả bằng ", "credit"],
    body: "Ứng dụng miễn phí, dùng với tài khoản Claude của bạn cũng miễn phí. Credit chỉ dành cho lúc bạn hết lượt hoặc không có gói Claude. Mua một lần, không bao giờ hết hạn.",
    popular: "Phổ biến nhất",
    credits: "credit",
    bonus: (percent) => `tặng thêm ${percent}%`,
    methods: {
      bank: "Ngân hàng Việt Nam · VietQR",
      card: "Thẻ · quốc tế",
    },
    buy: "Mua credit",
    pay: {
      bank: "Trang có mã VietQR mở trong trình duyệt, bạn quét bằng ứng dụng ngân hàng. Credit không bao giờ hết hạn.",
      card: "Trang thanh toán mở trong trình duyệt, do Paddle xử lý. Credit không bao giờ hết hạn.",
    },
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
        body: "Khi đã cài Claude Code, bấm + cạnh Accounts ở cuối cột chat, mỗi tài khoản một lần. Chưa có tài khoản? Đăng nhập bằng Google và dùng credit.",
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
        a: "Một ứng dụng desktop miễn phí chạy Claude Code cho bạn, trong một cửa sổ có sẵn dự án, nhiều chat cùng lúc, file, git và terminal. Điểm khác biệt: một cuộc chat có thể chuyển giữa các tài khoản Claude của bạn, hoặc sang credit, khi chạm giới hạn sử dụng.",
      },
      {
        q: "Giới hạn 5 giờ là gì?",
        a: "Gói Pro và Max của Claude cho phép dùng Claude Code đến một mức nhất định trong mỗi khoảng 5 giờ, kèm một giới hạn hằng tuần. Khi chạm mức đó, Claude Code dừng lại cho đến khi hạn mức reset. Vey Studio cho thấy mỗi tài khoản của bạn còn lại bao nhiêu.",
      },
      {
        q: "Chuyện gì xảy ra khi tôi chạm giới hạn?",
        a: "Chat dừng lại với một thẻ báo đã chạm giới hạn nào và khi nào reset. “Continue with …” chuyển nó sang tài khoản tiếp theo còn dư (credit để sau cùng) và gửi tiếp. Bạn cũng có thể tự chọn tài khoản trong ô soạn tin của chat. Cách nào thì tin nhắn tiếp theo vẫn nhớ mọi điều đã nói.",
      },
      {
        q: "Tôi thêm được bao nhiêu tài khoản Claude?",
        a: "Bao nhiêu cũng được. Mỗi tài khoản đăng nhập một lần và giữ nguyên trạng thái đăng nhập, nên chat nào cũng chạy được trên bất kỳ tài khoản nào.",
      },
      {
        q: "Tôi có cần gói Claude không?",
        a: "Không. Với credit, ứng dụng chạy mọi chat mà không cần tài khoản Claude riêng. Nếu bạn có tài khoản, ứng dụng dùng chính tài khoản đó và bạn không tốn gì.",
      },
      {
        q: "Tôi có cần cài Claude Code không?",
        a: "Có, nếu dùng tài khoản Claude riêng. Ứng dụng chạy chính claude CLI của bạn và đăng nhập từng tài khoản qua nó. Nếu chỉ chat bằng credit thì không cần.",
      },
      {
        q: "Credit có hết hạn không?",
        a: "Không. Bạn mua một lần, credit nằm trong tài khoản cho đến khi dùng hết, và không có phí hàng tháng.",
      },
      {
        q: "Một gói dùng được bao lâu?",
        a: "Mỗi câu trả lời chạy bằng credit đều ghi rõ đã tốn bao nhiêu đô la, nên bạn không phải đoán. Ước chừng, một lần gọi Sonnet với prompt phần lớn đã cache tốn khoảng $0,01–0,015, và một tin nhắn Claude Code thường gọi vài lần như vậy. Haiku chỉ tốn một phần hai mươi, Opus gấp đôi.",
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
}

export const COPY: Record<Lang, Copy> = { en, vi }
