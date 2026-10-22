<script setup lang="ts">
import DefaultTheme from "vitepress/theme"

import SiteNav from "./SiteNav.vue"

const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #layout-top>
      <SiteNav />
    </template>
  </Layout>
</template>
