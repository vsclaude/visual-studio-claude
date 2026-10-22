<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useData } from "vitepress"

import { APP_MARK, WORDMARK } from "../../../../server/utils/brand.ts"
import { COPY, LANGS, langOf, pathOf } from "../copy.ts"
import InlineStyle from "../InlineStyle.ts"
import { ICON, RELEASES_URL } from "../links.ts"
import { FEATURE_ART } from "./art.ts"
import {
  demoCss,
  FEATURE_ORDER,
  nth,
  PILLAR_ORDER,
  SPARKLE,
  WINDOW,
} from "./demo.ts"
import css from "./home.css?inline"
import { packsForSale } from "./packs.ts"

/*
 * The home page: what VS Claude is, what credits cost, and where to download
 * it. The words are `copy.ts`', one set per language; the prices are
 * `CREDIT_PACKS`' (`packs.ts`).
 *
 * **Restraint is the look.** The first version had a gradient on every
 * headline, glows, twinkling sparks and a ring of light round a price — and
 * read as generated. What is left: one accent colour, hairlines, small radii,
 * cells that share their borders like a table, a serif italic where a
 * headline wants weight, and motion only where it shows the product working.
 * The violet-to-amber gradient is the logo's and nothing else's.
 *
 * Every animation arrives at what the markup already draws, so taking it
 * away — reduced motion, no script — leaves the page whole.
 */

const { lang } = useData()
const t = computed(() => COPY[langOf(lang.value)])
const home = computed(() => pathOf(langOf(lang.value)))
const packs = packsForSale()
const year = new Date().getFullYear()
const style = css + "\n" + demoCss()
const LOGO = APP_MARK + WORDMARK
const STACK = "<span></span><span></span>" + APP_MARK

// Only the label: every button still goes to the releases page, which lists
// each platform's file — a guess that is wrong costs nothing but a word.
const os = ref<string | null>(null)
const downloadLabel = computed(() =>
  os.value ? t.value.cta.downloadFor + os.value : t.value.cta.download
)

const root = ref<HTMLElement>()
let seen: IntersectionObserver | undefined

onMounted(() => {
  const ua = navigator.userAgent
  os.value = /Mac/.test(ua)
    ? "macOS"
    : /Win/.test(ua)
      ? "Windows"
      : /Linux/.test(ua) && !/Android/.test(ua)
        ? "Linux"
        : null

  // Each section comes up once, as it is reached. No observer, no hiding:
  // everything is shown at once instead.
  const items = root.value?.querySelectorAll(".reveal") ?? []
  if (!("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("in"))
    return
  }
  seen = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add("in")
        seen?.unobserve(entry.target)
      }
    },
    { rootMargin: "0px 0px -8% 0px" }
  )
  items.forEach((el) => seen?.observe(el))
})

onBeforeUnmount(() => seen?.disconnect())
</script>

<template>
  <div ref="root" class="home-page">
    <InlineStyle :css="style" />

    <div class="wrap">
      <header class="hero">
        <span class="chip enter"
          ><span class="contents" v-html="SPARKLE"></span>{{ t.eyebrow }}</span
        >
        <h1 class="enter" style="--d: 0.08s">
          {{ t.h1[0] }} <em class="accent">{{ t.h1[1] }}</em>
        </h1>
        <p class="lede enter" style="--d: 0.16s">{{ t.lede }}</p>
        <div class="ctas enter" style="--d: 0.24s">
          <a class="button primary download" :href="RELEASES_URL"
            ><span>{{ downloadLabel }}</span><i v-html="ICON.download"></i
          ></a>
          <a class="button ghost" href="#credits"
            ><span>{{ t.cta.pricing }}</span><i v-html="ICON.arrow"></i
          ></a>
        </div>
        <p class="fine enter" style="--d: 0.3s">{{ t.fine }}</p>

        <figure class="window-frame enter" style="--d: 0.4s">
          <div class="window" aria-hidden="true" v-html="WINDOW"></div>
          <figcaption>{{ t.windowCaption }}</figcaption>
        </figure>
      </header>

      <section id="why">
        <div class="head reveal">
          <span class="kicker">{{ t.pillars.kicker }}</span>
          <h2>{{ t.pillars.title }}</h2>
          <p>{{ t.pillars.body }}</p>
        </div>
        <div class="grid pillars">
          <article
            v-for="(item, i) in t.pillars.items"
            :key="i"
            class="cell reveal"
            :style="`--d:${(i % 3) * 0.06}s`"
          >
            <span class="num">{{ nth(i) }}</span>
            <div class="art" v-html="FEATURE_ART[PILLAR_ORDER[i]]()"></div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.body }}</p>
          </article>
        </div>
      </section>

      <section id="features">
        <div class="head reveal">
          <span class="kicker">{{ t.features.kicker }}</span>
          <h2>{{ t.features.title }}</h2>
          <p>{{ t.features.body }}</p>
        </div>
        <div class="grid">
          <article
            v-for="(item, i) in t.features.items"
            :key="i"
            class="cell reveal"
            :style="`--d:${(i % 3) * 0.06}s`"
          >
            <span class="num">{{ nth(i) }}</span>
            <div class="art" v-html="FEATURE_ART[FEATURE_ORDER[i]]()"></div>
            <h3>{{ item.title }}</h3>
            <p>{{ item.body }}</p>
          </article>
        </div>
      </section>

      <section id="credits">
        <div class="head reveal">
          <span class="kicker">{{ t.pricing.kicker }}</span>
          <h2>
            {{ t.pricing.title[0] }}<em class="accent">{{ t.pricing.title[1] }}</em>
          </h2>
          <p>{{ t.pricing.body }}</p>
        </div>
        <div class="grid packs">
          <article
            v-for="(pack, i) in packs"
            :key="pack.id"
            class="cell pack reveal"
            :class="{ popular: pack.popular }"
            :style="`--d:${i * 0.06}s`"
          >
            <span class="num"
              ><em v-if="pack.popular">{{ t.pricing.popular }}</em
              ><template v-else>{{ nth(i) }}</template></span
            >
            <p class="pack-credits">
              <strong>{{ pack.credits }}</strong> {{ t.pricing.credits }}
            </p>
            <p class="pack-bonus">
              {{ pack.bonus ? t.pricing.bonus(pack.bonus) : t.pricing.starter }}
            </p>
            <p class="pack-price">{{ pack.price }}</p>
            <p class="pack-note">
              {{ pack.bankOnly ? t.pricing.bankOnly : t.pricing.note }}
            </p>
          </article>
        </div>
        <p class="pay">{{ t.pricing.pay }}</p>
      </section>

      <section>
        <div class="head reveal">
          <span class="kicker">{{ t.steps.kicker }}</span>
          <h2>{{ t.steps.title }}</h2>
        </div>
        <div class="grid steps">
          <div
            v-for="(step, i) in t.steps.items"
            :key="i"
            class="cell reveal"
            :style="`--d:${(i * 0.08).toFixed(2)}s`"
          >
            <span class="num">{{ nth(i) }}</span>
            <h3>{{ step.title }}</h3>
            <p>{{ step.body }}</p>
          </div>
        </div>
      </section>

      <section id="faq">
        <div class="head reveal">
          <span class="kicker">{{ t.faq.kicker }}</span>
          <h2>{{ t.faq.title }}</h2>
        </div>
        <div class="faq">
          <details v-for="(item, i) in t.faq.items" :key="i" class="reveal">
            <summary>{{ item.q }}</summary>
            <p>{{ item.a }}</p>
          </details>
        </div>
      </section>

      <section class="closing">
        <div
          class="stack reveal"
          aria-hidden="true"
          v-html="STACK"
        ></div>
        <h2 class="reveal">
          {{ t.closing[0] }}<em class="accent">{{ t.closing[1] }}</em>
        </h2>
        <div class="ctas reveal">
          <a class="button primary download" :href="RELEASES_URL"
            ><span>{{ downloadLabel }}</span><i v-html="ICON.download"></i
          ></a>
        </div>
      </section>
    </div>

    <footer>
      <div class="wrap">
        <div class="brand">
          <a class="logo" :href="home" v-html="LOGO"></a>
          <p>{{ t.footer.tagline }}</p>
          <p class="copy">© {{ year }} VS Claude</p>
        </div>
        <div>
          <h4>{{ t.footer.product }}</h4>
          <ul>
            <li>
              <a href="#features">{{ t.nav.features }}</a>
            </li>
            <li>
              <a href="#credits">{{ t.nav.pricing }}</a>
            </li>
            <li>
              <a href="#faq">{{ t.nav.faq }}</a>
            </li>
            <li>
              <a :href="RELEASES_URL">{{ t.footer.releases }}</a>
            </li>
          </ul>
        </div>
        <div>
          <h4>{{ t.nav.language }}</h4>
          <ul>
            <li v-for="l in LANGS" :key="l">
              <a :href="pathOf(l)" :hreflang="COPY[l].htmlLang">{{
                l === "en" ? "English" : "Tiếng Việt"
              }}</a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  </div>
</template>
