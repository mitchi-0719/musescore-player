import { createHash } from 'node:crypto'
import { type Dirent, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WEBMSCORE_ROOT = resolve(PROJECT_ROOT, 'node_modules/webmscore')
const WEBMSCORE_ENTRY_SUFFIX = '/node_modules/webmscore/webmscore.cdn.mjs'

const WEBMSCORE_ASSETS = {
  data: 'webmscore.lib.data',
  mem: 'webmscore.lib.mem.wasm',
  wasm: 'webmscore.lib.wasm',
} as const

const toPosixPath = (path: string) => path.split(sep).join('/')

const listFiles = (root: string): string[] => {
  const visit = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry: Dirent) => {
      const absolutePath = join(directory, entry.name)
      return entry.isDirectory() ? visit(absolutePath) : [absolutePath]
    })

  return visit(root)
}

const createServiceWorkerSource = (
  cacheVersion: string,
  coreUrls: string[],
  offlineUrls: string[]
) => `const CACHE_NAME = ${JSON.stringify(`musescore-player-${cacheVersion}`)}
const CORE_URLS = ${JSON.stringify(coreUrls)}
const OFFLINE_URLS = ${JSON.stringify(offlineUrls)}
const ALL_URLS = [...new Set([...CORE_URLS, ...OFFLINE_URLS])]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ALL_URLS))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter(
                (key) =>
                  key.startsWith('musescore-player-') && key !== CACHE_NAME
              )
              .map((key) => caches.delete(key))
          )
        ),
      self.clients.claim(),
    ])
  )
})

const cacheResponse = async (request, response) => {
  if (!response || !response.ok) return response

  const cache = await caches.open(CACHE_NAME)
  await cache.put(request, response.clone())
  return response
}

const createRangeResponse = async (request, cachedResponse) => {
  const range = request.headers.get('range')
  const match = range?.match(/^bytes=(\\d+)-(\\d*)$/)
  if (!match) return cachedResponse

  const buffer = await cachedResponse.arrayBuffer()
  const start = Number(match[1])
  const requestedEnd = match[2] ? Number(match[2]) : buffer.byteLength - 1
  const end = Math.min(requestedEnd, buffer.byteLength - 1)

  if (start > end || start >= buffer.byteLength) {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': \`bytes */\${buffer.byteLength}\` },
    })
  }

  const headers = new Headers(cachedResponse.headers)
  headers.set('Accept-Ranges', 'bytes')
  headers.set('Content-Length', String(end - start + 1))
  headers.set('Content-Range', \`bytes \${start}-\${end}/\${buffer.byteLength}\`)

  return new Response(buffer.slice(start, end + 1), {
    status: 206,
    statusText: 'Partial Content',
    headers,
  })
}

const handleNavigation = async (request) => {
  try {
    return await cacheResponse('/index.html', await fetch(request))
  } catch {
    return (
      (await caches.match('/index.html')) ||
      (await caches.match('/')) ||
      Response.error()
    )
  }
}

const handleAsset = async (request) => {
  const cachedResponse = await caches.match(request, {
    ignoreVary: true,
  })
  if (cachedResponse) {
    return request.headers.has('range')
      ? createRangeResponse(request, cachedResponse)
      : cachedResponse
  }

  return cacheResponse(request, await fetch(request))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    request.mode === 'navigate'
      ? handleNavigation(request)
      : handleAsset(request)
  )
})
`

export const webMscoreLocalAssets = (): Plugin => {
  const assetReferences = {} as Record<keyof typeof WEBMSCORE_ASSETS, string>
  let assetContentHash = ''
  let isBuild = false

  return {
    name: 'webmscore-local-assets',
    enforce: 'pre',
    configResolved(config) {
      isBuild = config.command === 'build'
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const requestUrl = new URL(request.url ?? '/', 'http://localhost')
        const prefix = '/@webmscore-assets/'
        if (!requestUrl.pathname.startsWith(prefix)) {
          next()
          return
        }

        const fileName = decodeURIComponent(
          requestUrl.pathname.slice(prefix.length)
        )
        if (
          !(Object.values(WEBMSCORE_ASSETS) as readonly string[]).includes(
            fileName
          )
        ) {
          response.statusCode = 404
          response.end()
          return
        }

        response.setHeader(
          'Content-Type',
          fileName.endsWith('.wasm')
            ? 'application/wasm'
            : 'application/octet-stream'
        )
        response.end(readFileSync(resolve(WEBMSCORE_ROOT, fileName)))
      })
    },
    buildStart() {
      if (!isBuild) return

      const assetHash = createHash('sha256')
      for (const [key, fileName] of Object.entries(WEBMSCORE_ASSETS) as [
        keyof typeof WEBMSCORE_ASSETS,
        string,
      ][]) {
        const source = readFileSync(resolve(WEBMSCORE_ROOT, fileName))
        assetHash.update(fileName).update(source)
        assetReferences[key] = this.emitFile({
          type: 'asset',
          name: fileName,
          source,
        })
      }
      assetContentHash = assetHash.digest('hex')
    },
    transform(code, id) {
      const normalizedId = toPosixPath(id.split('?')[0])
      if (!normalizedId.endsWith(WEBMSCORE_ENTRY_SUFFIX)) return

      const remoteAssetHeader =
        /const CDN_PROVIDER[\s\S]*?const libMem = [^\n]+\n/
      if (!remoteAssetHeader.test(code)) {
        this.error('Unable to locate the WebMscore CDN asset declarations')
      }

      const nodeRequirePattern = /require\((['"])(crypto|fs|path)\1\)/g
      const nodeRequires = [...code.matchAll(nodeRequirePattern)]
      if (nodeRequires.length === 0) {
        this.error('Unable to locate WebMscore Node.js-only imports')
      }

      const localAssetHeader = isBuild
        ? [
            `const libWasm = import.meta.ROLLUP_FILE_URL_${assetReferences.wasm}`,
            `const libData = import.meta.ROLLUP_FILE_URL_${assetReferences.data}`,
            `const libMem = import.meta.ROLLUP_FILE_URL_${assetReferences.mem}`,
            '',
          ].join('\n')
        : [
            `const libWasm = '/@webmscore-assets/${WEBMSCORE_ASSETS.wasm}'`,
            `const libData = '/@webmscore-assets/${WEBMSCORE_ASSETS.data}'`,
            `const libMem = '/@webmscore-assets/${WEBMSCORE_ASSETS.mem}'`,
            '',
          ].join('\n')

      return {
        code: code
          .replace(remoteAssetHeader, localAssetHeader)
          // These imports are contained in branches guarded by
          // ENVIRONMENT_IS_NODE/IS_NODE and cannot execute in a browser.
          .replace(nodeRequirePattern, 'undefined'),
        map: null,
      }
    },
    generateBundle(_options, bundle) {
      const outputUrls = Object.values(bundle)
        .map((output) => `/${output.fileName}`)
        .filter((url) => !url.endsWith('.map') && url !== '/sw.js')
        .sort()

      const coreBundleUrls = Object.values(bundle)
        .filter(
          (output) =>
            (output.type === 'chunk' && output.isEntry) ||
            output.fileName.endsWith('.css')
        )
        .map((output) => `/${output.fileName}`)
        .sort()

      const soundRoot = resolve(PROJECT_ROOT, 'public/sounds')
      const soundUrls = listFiles(soundRoot)
        .filter((filePath) => /\.(?:mp3|wav)$/i.test(filePath))
        .map(
          (filePath) => `/sounds/${toPosixPath(relative(soundRoot, filePath))}`
        )
        .sort()

      const coreUrls = [
        '/',
        '/index.html',
        '/manifest.json',
        '/favicon.ico',
        '/icon-192.png',
        '/icon-512.png',
        ...coreBundleUrls,
      ]
      const offlineUrls = [
        '/demo.mscz',
        ...outputUrls.filter((url) => !coreUrls.includes(url)),
        ...soundUrls,
      ]
      const cacheVersion = createHash('sha256')
        .update(assetContentHash)
        .update(JSON.stringify({ coreUrls, offlineUrls }))
        .digest('hex')
        .slice(0, 16)

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: createServiceWorkerSource(
          cacheVersion,
          [...new Set(coreUrls)],
          [...new Set(offlineUrls)]
        ),
      })
    },
  }
}
