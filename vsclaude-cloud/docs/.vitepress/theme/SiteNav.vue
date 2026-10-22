<script setup lang="ts">
import { computed } from "vue"
import { useData } from "vitepress"
import { VPNavBarSearch } from "vitepress/theme"

import { langOf } from "../../../server/utils/landing-copy.ts"
import {
  docsPathOf,
  navEnd,
  navStart,
} from "../../../server/utils/site-nav.ts"

/*
 * The home page's own bar (`server/utils/site-nav.ts`), in place of
 * VitePress's — so the guide reads as a page of the same site. Its language
 * switch goes to this page in the other language rather than to the home
 * page, and VitePress's search sits at the head of its right half.
 */
const { lang, page } = useData()

const current = computed(() => langOf(lang.value))

/** `vi/credits.md` → `credits`; an index is the locale's root. */
const slug = computed(() =>
  page.value.relativePath
    .replace(/^vi\//, "")
    .replace(/\.md$/, "")
    .replace(/(^|\/)index$/, "")
)

const start = computed(() => navStart(current.value))
const end = computed(() =>
  navEnd(current.value, (l) => docsPathOf(l) + slug.value)
)
</script>

<template>
  <div class="sky" aria-hidden="true"></div>
  <header class="site-header">
    <nav class="site-nav">
      <div class="parts" v-html="start"></div>
      <div class="nav-end">
        <VPNavBarSearch class="site-search" />
        <div class="parts" v-html="end"></div>
      </div>
    </nav>
  </header>
</template>
