import { defineConfig, type HeadConfig } from "vitepress"

import { APP_MARK_URL } from "../../server/utils/brand.ts"
import { COPY, LANGS, pathOf, type Lang } from "./theme/copy.ts"

/*
 * The site — the home page and the user's guide — built into `public/`, which
 * the Worker serves as static assets ahead of every route. `public/` is
 * gitignored and emptied by each build: a file meant to be served goes in
 * `site/public/`, which VitePress copies across.
 */

/** Which language's home page a page is, if it is one. */
function homeOf(relativePath: string): Lang | null {
  return (
    LANGS.find((lang) => `${pathOf(lang).slice(1)}index.md` === relativePath) ??
    null
  )
}

const searchVi = {
  translations: {
    button: { buttonText: "Tìm kiếm", buttonAriaLabel: "Tìm kiếm" },
    modal: {
      noResultsText: "Không tìm thấy kết quả cho",
      resetButtonTitle: "Xoá",
      footer: {
        selectText: "chọn",
        navigateText: "di chuyển",
        closeText: "đóng",
      },
    },
  },
}

export default defineConfig({
  title: "Vey Studio",
  outDir: "../public",
  // Workers' static assets resolve `/docs/foo` to `foo.html` themselves.
  cleanUrls: true,
  lastUpdated: true,
  // The home page is dark and has no switch; the guide is part of it.
  appearance: "force-dark",
  head: [
    ["link", { rel: "icon", href: APP_MARK_URL }],
    ["meta", { name: "theme-color", content: "#09090c" }],
    // Set before first paint, so a section waiting to `.reveal` is hidden
    // only when there is a script to reveal it.
    ["script", {}, `document.documentElement.classList.add("js")`],
    // Vietnamese was `/?lang=vi` while the Worker drew the home page. The
    // assets are answered before the Worker sees a request, so the old link
    // is sent on here rather than by a route.
    [
      "script",
      {},
      `if(location.pathname==="/"&&new URLSearchParams(location.search).get("lang")==="vi")location.replace("/vi/"+location.hash)`,
    ],
  ],

  // The home page's title, description and alternates are its copy's, so
  // they cannot drift from the words on it.
  transformPageData(pageData) {
    const lang = homeOf(pageData.relativePath)
    if (!lang) return
    const t = COPY[lang]
    pageData.title = t.title
    pageData.description = t.description
    pageData.titleTemplate = false
    pageData.frontmatter.head = [
      ["meta", { property: "og:title", content: "Vey Studio" }],
      ["meta", { property: "og:description", content: t.ogDescription }],
      ...LANGS.map((l): HeadConfig => [
        "link",
        { rel: "alternate", hreflang: COPY[l].htmlLang, href: pathOf(l) },
      ]),
      ["link", { rel: "alternate", hreflang: "x-default", href: "/" }],
    ]
  },

  themeConfig: {
    logo: "/logo.svg",
    search: { provider: "local", options: { locales: { vi: searchVi } } },
  },

  locales: {
    root: {
      label: "English",
      lang: "en",
      description: "How to use Vey Studio, the desktop studio for Claude Code.",
      themeConfig: {
        sidebar: [
          {
            text: "Guide",
            items: [
              { text: "Getting started", link: "/docs/getting-started" },
              { text: "Claude accounts", link: "/docs/accounts" },
              { text: "Credits", link: "/docs/credits" },
            ],
          },
          {
            text: "Using the studio",
            items: [
              { text: "Chats", link: "/docs/chats" },
              { text: "Projects and files", link: "/docs/projects-and-files" },
              { text: "Git", link: "/docs/git" },
              {
                text: "Terminal and search",
                link: "/docs/terminal-and-search",
              },
              { text: "Settings and plugins", link: "/docs/settings" },
            ],
          },
          {
            text: "Reference",
            items: [
              { text: "Keyboard shortcuts", link: "/docs/shortcuts" },
              { text: "Troubleshooting", link: "/docs/troubleshooting" },
            ],
          },
        ],
      },
    },
    vi: {
      label: "Tiếng Việt",
      lang: "vi",
      description:
        "Hướng dẫn sử dụng Vey Studio, studio desktop cho Claude Code.",
      themeConfig: {
        sidebar: [
          {
            text: "Hướng dẫn",
            items: [
              { text: "Bắt đầu", link: "/vi/docs/getting-started" },
              { text: "Tài khoản Claude", link: "/vi/docs/accounts" },
              { text: "Credit", link: "/vi/docs/credits" },
            ],
          },
          {
            text: "Dùng studio",
            items: [
              { text: "Chat", link: "/vi/docs/chats" },
              { text: "Project và file", link: "/vi/docs/projects-and-files" },
              { text: "Git", link: "/vi/docs/git" },
              {
                text: "Terminal và tìm kiếm",
                link: "/vi/docs/terminal-and-search",
              },
              { text: "Cài đặt và plugin", link: "/vi/docs/settings" },
            ],
          },
          {
            text: "Tham khảo",
            items: [
              { text: "Phím tắt", link: "/vi/docs/shortcuts" },
              { text: "Xử lý sự cố", link: "/vi/docs/troubleshooting" },
            ],
          },
        ],
        outline: { label: "Trên trang này" },
        docFooter: { prev: "Trang trước", next: "Trang sau" },
        lastUpdated: { text: "Cập nhật lần cuối" },
        darkModeSwitchLabel: "Giao diện",
        sidebarMenuLabel: "Menu",
        returnToTopLabel: "Lên đầu trang",
        langMenuLabel: "Ngôn ngữ",
      },
    },
  },
})
