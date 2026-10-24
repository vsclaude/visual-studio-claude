<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useData } from "vitepress"

import { APP_MARK, WORDMARK } from "../../../../server/utils/brand.ts"
import { COPY, LANGS, docsStartOf, langOf, pathOf } from "../copy.ts"
import InlineStyle from "../InlineStyle.ts"
import { useDownload } from "../download.ts"
import { ICON } from "../links.ts"
import { FEATURE_ART } from "./art.ts"
import { demoCss, FEATURE_ORDER, nth, PILLAR_ORDER, SPARKLE } from "./demo.ts"
import css from "./home.css?inline"
import { coin, METHOD_ICON, packsForSale, type PaymentMethod } from "./packs.ts"

/*
 * The home page: what Vey Studio is, what credits cost, and where to download
 * it. The words are `copy.ts`', one set per language; the prices are
 * `CREDIT_PACKS`' (`packs.ts`).
 *
 * **Restraint is the look.** The first version had a gradient on every
 * headline, glows, twinkling sparks and a ring of light round a price — and
 * read as generated. What is left: one accent colour, hairlines, small radii,
 * cells that share their borders like a table, a serif italic where a
 * headline wants weight, and motion only where it shows the product working.
 * The violet-to-amber gradient is the logo's — and the credits', as in the
 * studio, where it means "this is about credits": the packs borrow the buy
 * dialog's look so the page and the app sell the same thing the same way.
 *
 * Every animation arrives at what the markup already draws, so taking it
 * away — reduced motion, no script — leaves the page whole.
 */

const { lang } = useData()
const t = computed(() => COPY[langOf(lang.value)])
const home = computed(() => pathOf(langOf(lang.value)))
// Every build, named — for a Mac the button guessed wrong for, or another OS.
const downloads = computed(() => `${docsStartOf(langOf(lang.value))}#install`)
const METHODS: PaymentMethod[] = ["bank", "card"]
const method = ref<PaymentMethod>("bank")
const packs = computed(() => packsForSale(method.value))
const year = new Date().getFullYear()
const style = css + "\n" + demoCss()
const LOGO = APP_MARK + WORDMARK
const STACK = "<span></span><span></span>" + APP_MARK

const { os, href: downloadHref } = useDownload(downloads)
const downloadLabel = computed(() =>
  os.value ? t.value.cta.downloadFor + os.value : t.value.cta.download
)

const root = ref<HTMLElement>()
const demo = ref<HTMLVideoElement>()
let seen: IntersectionObserver | undefined

onMounted(() => {
  // Autoplay ignores the stylesheet's reduced-motion rule, so the video
  // is held on its first frame here instead.
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    demo.value?.pause()
  }

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
          <a class="button primary download" :href="downloadHref"
            ><span>{{ downloadLabel }}</span
            ><i v-html="ICON.download"></i
          ></a>
          <a class="button ghost" href="#credits"
            ><span>{{ t.cta.pricing }}</span
            ><i v-html="ICON.arrow"></i
          ></a>
        </div>
        <p class="fine enter" style="--d: 0.3s">
          <a :href="downloads">{{ t.fine[0] }}</a
          >&nbsp;·&nbsp;{{ t.fine[1] }}
        </p>

        <figure class="window-frame enter" style="--d: 0.4s">
          <video
            ref="demo"
            class="window"
            src="/demo/vey-studio-demo.mp4"
            autoplay
            muted
            loop
            playsinline
            preload="metadata"
            aria-hidden="true"
          ></video>
          <figcaption>{{ t.windowCaption }}</figcaption>
        </figure>
      </header>

      <section id="why">
        <div class="head reveal">
          <span class="kicker">{{ t.pillars.kicker }}</span>
          <h2>{{ t.pillars.title }}</h2>
          <p>{{ t.pillars.body }}</p>
        </div>
        <div class="pillars grid">
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
            {{ t.pricing.title[0]
            }}<em class="accent">{{ t.pricing.title[1] }}</em>
          </h2>
          <p>{{ t.pricing.body }}</p>
        </div>
        <!-- The studio's Buy credits dialog, drawn: the toggle switches the
             packs shown, and nothing here buys — that is the app's. -->
        <div class="buy reveal">
          <div class="methods" role="radiogroup">
            <button
              v-for="m in METHODS"
              :key="m"
              type="button"
              role="radio"
              :aria-checked="method === m"
              :class="{ on: method === m }"
              @click="method = m"
            >
              <i v-html="METHOD_ICON[m]"></i>{{ t.pricing.methods[m] }}
            </button>
          </div>
          <div class="packs" :style="`--n:${packs.length}`">
            <article
              v-for="pack in packs"
              :key="pack.id"
              class="pack"
              :class="{ popular: pack.popular }"
            >
              <span v-if="pack.popular" class="pack-flag"
                ><i v-html="SPARKLE"></i>{{ t.pricing.popular }}</span
              >
              <span
                class="pack-coin"
                v-html="coin(`coin-${pack.id}`, pack.popular ? 34 : 28)"
              ></span>
              <p class="pack-price">{{ pack.price }}</p>
              <p class="pack-credits">
                {{ pack.credits }} {{ t.pricing.credits }}
              </p>
              <p v-if="pack.bonus" class="pack-bonus">
                {{ t.pricing.bonus(pack.bonus) }}
              </p>
              <span class="pack-buy" aria-hidden="true">{{
                t.pricing.buy
              }}</span>
            </article>
          </div>
          <p class="pay">{{ t.pricing.pay[method] }}</p>
        </div>
      </section>

      <section>
        <div class="head reveal">
          <span class="kicker">{{ t.steps.kicker }}</span>
          <h2>{{ t.steps.title }}</h2>
        </div>
        <div class="steps grid">
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
        <div class="stack reveal" aria-hidden="true" v-html="STACK"></div>
        <h2 class="reveal">
          {{ t.closing[0] }}<em class="accent">{{ t.closing[1] }}</em>
        </h2>
        <div class="ctas reveal">
          <a class="button primary download" :href="downloadHref"
            ><span>{{ downloadLabel }}</span
            ><i v-html="ICON.download"></i
          ></a>
        </div>
      </section>
    </div>

    <footer>
      <div class="wrap">
        <div class="brand">
          <a class="logo" :href="home" v-html="LOGO"></a>
          <p>{{ t.footer.tagline }}</p>
          <p class="copy">© {{ year }} Vey Studio</p>
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
              <a :href="downloads">{{ t.footer.download }}</a>
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
