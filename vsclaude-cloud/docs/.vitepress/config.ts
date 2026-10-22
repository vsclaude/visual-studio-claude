import { defineConfig } from "vitepress"

import { APP_MARK_URL } from "../../server/utils/brand.ts"
import {
  SITE_NAV_CSS,
  SITE_TOKENS_CSS,
} from "../../server/utils/site-nav.ts"

/*
 * The user's guide, built into `public/docs/` so the same Worker serves it at
 * `/docs` — one deploy, one domain, no Pages project beside it. `public/docs`
 * is gitignored: it is rebuilt by `bun run build` before Nitro copies it.
 */
export default defineConfig({
  title: "VS Claude",
  base: "/docs/",
  outDir: "../public/docs",
  // Workers' static assets resolve `/docs/foo` to `foo.html` themselves.
  cleanUrls: true,
  lastUpdated: true,
  // The home page is dark and has no switch; the guide is part of it.
  appearance: "force-dark",
  head: [
    ["link", { rel: "icon", href: APP_MARK_URL }],
    ["meta", { name: "theme-color", content: "#09090c" }],
    // The home page's palette and bar, as the theme's `SiteNav` draws it.
    ["style", {}, `${SITE_TOKENS_CSS}\n${SITE_NAV_CSS}`],
  ],

  themeConfig: {
    logo: "/logo.svg",
    search: {
      provider: "local",
      options: {
        locales: {
          vi: {
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
          },
        },
      },
    },
  },

  locales: {
    root: {
      label: "English",
      lang: "en",
      description: "How to use VS Claude, the desktop studio for Claude Code.",
      themeConfig: {
        nav: [{ text: "Guide", link: "/getting-started" }],
        sidebar: [
          {
            text: "Guide",
            items: [
              { text: "Getting started", link: "/getting-started" },
              { text: "Claude accounts", link: "/accounts" },
              { text: "Credits", link: "/credits" },
            ],
          },
        ],
      },
    },
    vi: {
      label: "Tiếng Việt",
      lang: "vi",
      description: "Hướng dẫn sử dụng VS Claude, studio desktop cho Claude Code.",
      themeConfig: {
        nav: [{ text: "Hướng dẫn", link: "/vi/getting-started" }],
        sidebar: [
          {
            text: "Hướng dẫn",
            items: [
              { text: "Bắt đầu", link: "/vi/getting-started" },
              { text: "Tài khoản Claude", link: "/vi/accounts" },
              { text: "Credit", link: "/vi/credits" },
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
