import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Tell the browser about the predictions file before the JavaScript does.
 *
 * Nothing in index.html mentions the data, so the largest file on the page is
 * requested last: the browser has to download and parse the bundle, mount
 * React and run an effect before it learns the name. A preload link starts
 * that download alongside the bundle instead, so it is already in the cache by
 * the time the dashboard asks.
 *
 * The filename depends on which model the snapshot published, which is why
 * this is generated rather than hardcoded. `crossorigin` is required: without
 * it the preload is a no-cors request, fetch() issues a cors one, the two do
 * not match and the file is downloaded twice.
 */
function preloadDefaultPredictions() {
  return {
    name: 'preload-default-predictions',
    transformIndexHtml() {
      // Resolved against this config file rather than the working directory,
      // because the build runs from the repo root as often as from app/.
      const path = new URL('public/data/manifest.json', import.meta.url)
      let model
      try {
        model = JSON.parse(readFileSync(path, 'utf8')).default_model
      } catch (err) {
        // A missing or malformed manifest costs a round trip, not a build. The
        // site still works; it just loads the way it did before this plugin.
        console.warn(`[preload] skipped, could not read ${path}: ${err.message}`)
        return []
      }
      if (typeof model !== 'string' || !/^[a-z0-9_]+$/.test(model)) {
        console.warn(`[preload] skipped, unusable default_model: ${JSON.stringify(model)}`)
        return []
      }
      return [
        {
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'fetch',
            crossorigin: '',
            href: `/data/predictions_${model}.json`,
          },
          injectTo: 'head',
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadDefaultPredictions()],
  test: {
    environment: 'happy-dom',
    setupFiles: './src/test/setup.js',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/test/**', 'src/mocks/**'],
    },
  },
})
