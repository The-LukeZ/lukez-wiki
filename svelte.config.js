import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { svelteMarkdownPreprocessor } from "./preprocessor.js";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: [vitePreprocess(), svelteMarkdownPreprocessor],
  kit: {
    adapter: adapter(),
    router: { type: "hash" },
    paths: {
      base: process.argv.includes("dev") ? "" : process.env.BASE_PATH,
    },
  },
  extensions: [".svelte", ".svelte.md"],
};

export default config;
