#!/usr/bin/env node
/**
 * Auditoria Lighthouse: Início e Detalhe do NFT, perfis mobile e desktop,
 * 3 medições por página/perfil, mediana por categoria + LCP/CLS/TBT.
 * Usa o build otimizado servido por `vite preview` com o cenário padrão dos mocks.
 *
 * Uso: pnpm build && pnpm lighthouse   (ou LH_URL=https://app.vercel.app pnpm lighthouse)
 */
import { spawn } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import lighthouse from 'lighthouse'
import * as chromeLauncher from 'chrome-launcher'

const require = createRequire(import.meta.url)
const config = JSON.parse(await readFile(new URL('../lighthouse.config.json', import.meta.url), 'utf8'))
const RUNS = config.runs
const outDir = path.resolve('lighthouse-reports')
await mkdir(outDir, { recursive: true })

let preview
const baseUrl = process.env.LH_URL ?? `http://localhost:${config.port}`
if (!process.env.LH_URL) {
  preview = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(config.port), '--strictPort'], { stdio: 'ignore', env: { ...process.env } })
  await waitFor(baseUrl)
}

const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROME_PATH,
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
})

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

const summary = { generatedAt: new Date().toISOString(), baseUrl, runsPerPage: RUNS, environment: env(), results: [] }

try {
  for (const page of config.pages) {
    for (const profile of config.profiles) {
      const runs = []
      for (let i = 1; i <= RUNS; i++) {
        const flags = { port: chrome.port, output: ['html', 'json'], logLevel: 'error', onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'] }
        const lhConfig = profile === 'desktop' ? (await import('lighthouse/core/config/desktop-config.js')).default : undefined
        const result = await lighthouse(`${baseUrl}${page.path}`, flags, lhConfig)
        const [html, json] = result.report
        const base = `${page.name}-${profile}-run${i}`
        await writeFile(path.join(outDir, `${base}.html`), html)
        await writeFile(path.join(outDir, `${base}.json`), json)
        const lhr = result.lhr
        runs.push({
          performance: Math.round(lhr.categories.performance.score * 100),
          accessibility: Math.round(lhr.categories.accessibility.score * 100),
          bestPractices: Math.round(lhr.categories['best-practices'].score * 100),
          seo: Math.round(lhr.categories.seo.score * 100),
          lcpMs: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
          cls: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
          tbtMs: Math.round(lhr.audits['total-blocking-time'].numericValue),
          lighthouseVersion: lhr.lighthouseVersion,
          userAgent: lhr.environment.hostUserAgent,
        })
        console.log(`${base}: perf ${runs.at(-1).performance} a11y ${runs.at(-1).accessibility} bp ${runs.at(-1).bestPractices} seo ${runs.at(-1).seo}`)
      }
      const keys = ['performance', 'accessibility', 'bestPractices', 'seo', 'lcpMs', 'cls', 'tbtMs']
      const med = Object.fromEntries(keys.map((k) => [k, median(runs.map((r) => r[k]))]))
      summary.results.push({ page: page.name, path: page.path, profile, median: med, runs })
    }
  }
} finally {
  await chrome.kill()
  preview?.kill()
}

summary.lighthouseVersion = summary.results[0]?.runs[0]?.lighthouseVersion
await writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2))
await writeFile(path.join(outDir, 'SUMMARY.md'), toMarkdown(summary))
console.log(toMarkdown(summary))

function toMarkdown(s) {
  const rows = s.results
    .map((r) => `| ${r.page} | ${r.profile} | ${r.median.performance} | ${r.median.accessibility} | ${r.median.bestPractices} | ${r.median.seo} | ${r.median.lcpMs} | ${r.median.cls} | ${r.median.tbtMs} |`)
    .join('\n')
  return `# Lighthouse — mediana de ${s.runsPerPage} execuções\n\nGerado em ${s.generatedAt} contra ${s.baseUrl}\n\n| Página | Perfil | Perf | A11y | BP | SEO | LCP (ms) | CLS | TBT (ms) |\n|---|---|---|---|---|---|---|---|---|\n${rows}\n\nLighthouse ${s.lighthouseVersion} · Node ${s.environment.node} · ${s.environment.os} · CPU ${s.environment.cpu}\n`
}

function env() {
  return {
    node: process.version,
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: `${os.cpus()[0]?.model ?? 'unknown'} x${os.cpus().length}`,
    memoryGb: Math.round(os.totalmem() / 1024 ** 3),
    lighthouse: require('lighthouse/package.json').version,
    chromeLauncher: require('chrome-launcher/package.json').version,
  }
}

async function waitFor(url, ms = 30_000) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {
      /* aguardando */
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Preview não respondeu em ${url}`)
}
