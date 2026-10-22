// `tsc -p .` sees the theme's `import Layout from "./Layout.vue"`; VitePress
// compiles the file itself, so all the type check needs is that it exists.
declare module "*.vue" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent
  export default component
}
