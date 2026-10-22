import type { Theme } from "vitepress"
import DefaultTheme from "vitepress/theme"

import Home from "./home/Home.vue"
import Layout from "./Layout.vue"
import "./site.css"
import "./brand.css"

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    // `index.md` and `vi/index.md` are `<Home />` and nothing else, under
    // `layout: home-page` (`Layout.vue`).
    app.component("Home", Home)
  },
} satisfies Theme
