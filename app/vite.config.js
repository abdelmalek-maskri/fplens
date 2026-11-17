import { env } from 'node:process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { ROUTE_META, pageTitle } from './src/lib/routeMeta.js'

// Absolute URLs, which Open Graph requires: a relative og:image is ignored by
// every scraper. Overridable so a preview deployment advertises itself rather
// than production.
const SITE_URL = (env.SITE_URL || 'https://fplens.abdelmalekmaskri18.workers.dev').replace(
  /\/+$/,
  ''
)
const OG_IMAGE = '/og-image.png'

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

function escapeAttr(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Give every route its own HTML file, so a shared link says where it goes.
 *
 * Cloudflare serves index.html for any path that is not a real file, which
 * means all ten routes currently answer with one title, one description and
 * no Open Graph tags at all. Paste any of them into a chat and the preview
 * card is identical.
 *
 * These files are byte-for-byte the built index.html with four tags swapped:
 * same bundle, same router, same behaviour once React mounts. The dynamic
 * /player/:id route keeps the fallback, because its id is not known here.
 *
 * Written in closeBundle rather than emitted as assets so the copies include
 * whatever transformIndexHtml already injected, the preload link included.
 */
function perRouteHtml() {
  return {
    name: 'per-route-html',
    apply: 'build',
    closeBundle() {
      const outDir = new URL('dist/', import.meta.url)
      const indexPath = new URL('index.html', outDir)
      let html
      try {
        html = readFileSync(indexPath, 'utf8')
      } catch (err) {
        // Nothing to copy from. The SPA fallback still serves every route, so
        // this costs link previews rather than the site.
        console.warn(`[per-route-html] skipped, could not read ${indexPath}: ${err.message}`)
        return
      }

      let written = 0
      for (const [route, meta] of Object.entries(ROUTE_META)) {
        const title = escapeAttr(pageTitle(route))
        const description = escapeAttr(meta.description)
        const url = `${SITE_URL}${route}`
        const tags = [
          `<meta property="og:type" content="website">`,
          `<meta property="og:site_name" content="FPLens">`,
          `<meta property="og:title" content="${title}">`,
          `<meta property="og:description" content="${description}">`,
          `<meta property="og:url" content="${url}">`,
          `<meta property="og:image" content="${SITE_URL}${OG_IMAGE}">`,
          `<meta name="twitter:card" content="summary_large_image">`,
          `<link rel="canonical" href="${url}">`,
        ].join('\n    ')

        const page = html
          .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
          .replace(
            /<meta\s+name="description"[^>]*>/,
            `<meta name="description" content="${description}">`
          )
          .replace('</head>', `  ${tags}\n  </head>`)

        // /accuracy/index.html, which Cloudflare serves for /accuracy: a real
        // file wins over the single-page-application fallback. The dashboard
        // overwrites index.html itself, which is both the root route and the
        // fallback every other path still falls through to.
        const distDir = dirname(indexPath.pathname)
        const file = route === '/' ? join(distDir, 'index.html') : join(distDir, route.slice(1), 'index.html')
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, page, 'utf8')
        written += 1
      }
      console.log(`[per-route-html] wrote ${written} route pages against ${SITE_URL}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), preloadDefaultPredictions(), perRouteHtml()],
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
