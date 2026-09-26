#!/usr/bin/env node
// Drives a disposable instance of the dashboard for verification. See SKILL.md; `--help` lists commands.
import { execFileSync, spawn } from 'node:child_process'
import { appendFileSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const SKILL = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(SKILL, '../../..')
// Express will not serve files from a path containing a dot-directory, so the scratch instance lives outside the repo.
const RUN = '/tmp/dashboard-verify'
const EVIDENCE_ROOT = path.join(ROOT, '.verify/evidence')
const STATE = path.join(RUN, 'state.json')
const USER_DATA = path.join(ROOT, 'data/projects.json')
const OCR_BINARY = path.join(os.homedir(), 'Library/Caches/dashboard-verify/vision-ocr')
const PORTS = { api: 3101, web: 5273, cdp: 9333 }
const WEB = `http://127.0.0.1:${PORTS.web}`
const PLAYWRIGHT_VERSION = JSON.parse(readFileSync(path.join(ROOT, 'node_modules/playwright-core/package.json'), 'utf8')).version
const VIEWPORTS = { desktop: [1440, 900], 'ipad-landscape': [1180, 820], 'ipad-portrait': [820, 1180], narrow: [900, 1000] }

const HELP = `control-dashboard: drive a disposable dashboard instance and capture evidence.

Instance (API :${PORTS.api}, web :${PORTS.web}, headless Chromium CDP :${PORTS.cdp}; your own dev server is never touched)
  up [--semantic] [--from-real-data]
                           seed fixtures into /tmp/dashboard-verify and start API, Vite, and Chromium.
                           --semantic uses your real Gemini key; default sends an invalid key so search stays keyword-only.
                           --from-real-data copies data/projects.json (never its images, so nothing is sent to Gemini)
                           and records how the committed code (HEAD) reads it, for storage-format checks.
  doctor                   read-only health check; exit 1 when the instance is not worth driving.
  down                     stop what "up" started and delete /tmp/dashboard-verify. Evidence stays.

Browser (Chromium, persistent page between commands)
  open [path] [--viewport desktop|ipad-landscape|ipad-portrait|narrow]
  click   TARGET [--right] [--dialog accept|dismiss]
  fill    TARGET --value TEXT
  press   KEY [TARGET]            e.g. press Meta+Enter --label "New note"; press Escape
  upload  TARGET --file PATH      clicks TARGET and answers the file chooser
  reload
  snapshot [TARGET]               accessibility tree (YAML) of the page or TARGET
  screenshot NAME [--full]        saves evidence/<run>/NAME.png
  eval JS                         read-only inspection after a user action; never use it to perform the action

Side effects and other engines
  data [--project ID]             print the disposable projects.json the API wrote
  baseline-diff                   --from-real-data only: compare what the API now serves with how HEAD read
                                  the same file at "up"; lists missing, added, and changed records per project
  webkit-shot NAME [path] [--portrait]
                                  WebKit (Safari's engine) with an emulated iPad Pro 11 viewport and touch.
                                  Not a real iPad; report iPad-only behavior as unverified.

TARGET (combine to narrow; first match must be unique unless --nth is given)
  --role ROLE --name NAME   accessible role and name, e.g. --role button --name "New board"
  --label TEXT              form control by aria-label/label, e.g. --label "Add a task"
  --text TEXT               visible text
  --css SELECTOR            fallback, e.g. --css '[data-item-id="note-method"]'
  --within CSS              scope the search, e.g. --within '.todo-panel'
  --exact  --nth N

Every command prints one JSON object. "ok" is false when the command failed or produced problems: console errors,
failed requests, a failed save, or an error banner. "problems" lists them; an expected failure (e.g. an empty title
being refused) still reports ok: false, so say in the report that it was expected.
Commands and results are appended to evidence/<run>/commands.jsonl.`

const OPTIONS = {
  role: { type: 'string' }, name: { type: 'string' }, label: { type: 'string' }, text: { type: 'string' },
  css: { type: 'string' }, within: { type: 'string' }, exact: { type: 'boolean' }, nth: { type: 'string' },
  value: { type: 'string' }, file: { type: 'string' }, dialog: { type: 'string' }, right: { type: 'boolean' },
  viewport: { type: 'string' }, full: { type: 'boolean' }, portrait: { type: 'boolean' }, project: { type: 'string' },
  semantic: { type: 'boolean' }, 'from-real-data': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
}

class UsageError extends Error {}

const readState = () => existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : null
const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
const listener = (port) => {
  try {
    return Number(execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).trim().split('\n')[0]) || null
  } catch {
    return null
  }
}
const descendants = (pid) => {
  try {
    const children = execFileSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).map(Number)
    return [pid, ...children.flatMap(descendants)]
  } catch {
    return [pid]
  }
}
// Browsers come from Playwright's shared cache (~/Library/Caches/ms-playwright, or PLAYWRIGHT_BROWSERS_PATH).
// Check before launching so a cleared cache fails with the fix instead of a spawn error.
function requireBrowser(browserType, name) {
  const executable = browserType.executablePath()
  if (!existsSync(executable)) {
    throw new UsageError(`${name} for playwright-core ${PLAYWRIGHT_VERSION} is not installed (expected ${executable}). Run "npm run verify:browsers", then retry.`)
  }
  return executable
}

const fingerprint = (file) => existsSync(file) ? (({ size, mtimeMs }) => ({ size, mtimeMs }))(statSync(file)) : null

async function waitFor(what, check, log, timeout = 40000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      if (await check()) return
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`${what} did not become ready in ${timeout / 1000}s. Read ${log}, then run "down" before retrying.`)
}

function start(name, command, args, env) {
  const log = path.join(RUN, 'logs', `${name}.log`)
  const out = openSync(log, 'a')
  const child = spawn(command, args, { cwd: ROOT, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', out, out] })
  child.unref()
  return { pid: child.pid, log }
}

// Verification processes, recognised by command line so "down" never signals a pid the OS has since reused.
const EXPECTED_COMMAND = { api: 'server/index.js', web: 'vite', chromium: '--remote-debugging-port' }
const commandOf = (pid) => {
  try {
    return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

// How the committed store code reads a data file: the reference for storage-format changes.
async function readWithHead(dataFile) {
  const store = path.join(RUN, 'baseline/project-store.mjs')
  mkdirSync(path.dirname(store), { recursive: true })
  writeFileSync(store, execFileSync('git', ['show', 'HEAD:server/project-store.js'], { cwd: ROOT, encoding: 'utf8' }))
  process.env.PROJECTS_DATA_FILE = dataFile
  const { listProjects } = await import(store)
  return listProjects()
}

async function up(values) {
  const { semantic } = values
  const realData = Boolean(values['from-real-data'])
  const existing = readState()
  if (existing) throw new UsageError(`An instance is already recorded in ${STATE}. Run "doctor" to check it, or "down" to replace it.`)
  for (const [role, port] of Object.entries(PORTS)) {
    const owner = listener(port)
    if (owner) throw new UsageError(`Port ${port} (${role}) is held by pid ${owner}, which "up" did not start. Stop it or change PORTS in control-dashboard.mjs.`)
  }
  const { chromium } = await import('playwright-core')
  const chromiumExecutable = requireBrowser(chromium, 'Chromium')
  rmSync(RUN, { recursive: true, force: true })
  mkdirSync(path.join(RUN, 'logs'), { recursive: true })
  mkdirSync(path.dirname(OCR_BINARY), { recursive: true })
  if (realData) {
    if (!existsSync(USER_DATA)) throw new UsageError(`${USER_DATA} does not exist; --from-real-data needs it.`)
    cpSync(USER_DATA, path.join(RUN, 'data/projects.json'))
    mkdirSync(path.join(RUN, 'data/files'), { recursive: true })
    writeFileSync(path.join(RUN, 'baseline/head.json'), JSON.stringify(await readWithHead(path.join(RUN, 'data/projects.json')), null, 2))
  } else {
    cpSync(path.join(SKILL, 'fixtures/projects.json'), path.join(RUN, 'data/projects.json'))
    cpSync(path.join(SKILL, 'fixtures/files'), path.join(RUN, 'data/files'), { recursive: true })
  }
  const evidence = path.join(EVIDENCE_ROOT, new Date().toISOString().replace(/[:.]/g, '-'))
  mkdirSync(evidence, { recursive: true })

  const node = process.execPath
  const api = start('api', node, ['server/index.js'], {
    API_PORT: String(PORTS.api),
    PROJECTS_DATA_FILE: path.join(RUN, 'data/projects.json'),
    PROJECTS_FILES_DIR: path.join(RUN, 'data/files'),
    SEARCH_INDEX_FILE: path.join(RUN, 'data/search/index.json'),
    EMBEDDING_INDEX_FILE: path.join(RUN, 'data/search/embeddings.json'),
    OCR_BINARY_FILE: OCR_BINARY,
    ...(semantic ? {} : { GEMINI_API_KEY: 'verify-offline-invalid-key' }),
  })
  const web = start('web', node, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(PORTS.web), '--strictPort'], {
    API_PROXY_TARGET: `http://127.0.0.1:${PORTS.api}`,
  })
  const browser = start('chromium', chromiumExecutable, [
    '--headless=new', `--remote-debugging-port=${PORTS.cdp}`, `--user-data-dir=${path.join(RUN, 'chromium-profile')}`,
    '--no-first-run', '--no-default-browser-check', `--window-size=${VIEWPORTS.desktop.join(',')}`, 'about:blank',
  ], {})
  const state = { startedAt: new Date().toISOString(), pids: { api: api.pid, web: web.pid, chromium: browser.pid }, evidence, semantic: Boolean(semantic), realData, userData: fingerprint(USER_DATA) }
  writeFileSync(STATE, JSON.stringify(state, null, 2))

  await waitFor('API', async () => (await fetch(`http://127.0.0.1:${PORTS.api}/api/health`)).ok, api.log)
  await waitFor('Vite', async () => (await fetch(WEB)).ok, web.log)
  await waitFor('Chromium', async () => (await fetch(`http://127.0.0.1:${PORTS.cdp}/json/version`)).ok, browser.log)
  return {
    started: state.pids, web: WEB, evidence,
    data: realData ? 'copy of data/projects.json without images; image requests 404 by design' : 'fixtures',
    semanticSearch: state.semantic ? 'real Gemini key' : 'off (keyword and OCR only)',
    next: realData ? 'doctor, then baseline-diff before and after the change' : 'doctor, then open',
  }
}

async function doctor() {
  const state = readState()
  if (!state) return { ok: false, problem: 'No instance recorded. Run "up".' }
  const checks = {}
  for (const [role, port] of [['api', PORTS.api], ['web', PORTS.web], ['chromium', PORTS.cdp]]) {
    const pid = state.pids[role]
    const owner = listener(port)
    checks[role] = { pid, running: alive(pid), portOwnedByUs: owner !== null && descendants(pid).includes(owner) }
  }
  const probe = async (url) => {
    try {
      return (await fetch(url)).ok
    } catch {
      return false
    }
  }
  checks.apiHealth = await probe(`http://127.0.0.1:${PORTS.api}/api/health`)
  // Both the direct API and the browser's path through Vite must serve the scratch copy, not another API.
  const scratchIds = JSON.parse(readFileSync(path.join(RUN, 'data/projects.json'), 'utf8')).map((project) => project.id).sort().join()
  const servesScratch = async (base) => {
    try {
      const ids = (await (await fetch(`${base}/api/projects`)).json()).map((project) => project.id)
      return ids.length > 0 && ids.sort().join() === scratchIds && (state.realData || ids.every((id) => id.startsWith('verify-')))
    } catch {
      return false
    }
  }
  checks.apiServesScratchData = await servesScratch(`http://127.0.0.1:${PORTS.api}`)
  checks.webProxiesToVerifyApi = await servesScratch(WEB)
  checks.yourDataUntouched = JSON.stringify(fingerprint(USER_DATA)) === JSON.stringify(state.userData)
  const ok = ['api', 'web', 'chromium'].every((role) => checks[role].running && checks[role].portOwnedByUs)
    && checks.apiHealth && checks.apiServesScratchData && checks.webProxiesToVerifyApi && checks.yourDataUntouched
  return { ok, checks, data: state.realData ? 'real-data copy' : 'fixtures', evidence: state.evidence, ...(ok ? {} : { next: 'Read /tmp/dashboard-verify/logs/*.log. If a process died, run "down" then "up".' }) }
}

async function down() {
  const state = readState()
  const stopped = []
  const skipped = []
  if (state) {
    for (const [role, pid] of Object.entries(state.pids)) {
      if (!alive(pid)) continue
      if (!commandOf(pid).includes(EXPECTED_COMMAND[role])) {
        skipped.push({ role, pid, reason: 'pid now belongs to another program' })
        continue
      }
      try {
        process.kill(-pid, 'SIGTERM')
      } catch {
        process.kill(pid, 'SIGTERM')
      }
      stopped.push(role)
    }
    await new Promise((resolve) => setTimeout(resolve, 800))
    for (const [role, pid] of Object.entries(state.pids)) {
      if (!stopped.includes(role)) continue
      for (const child of descendants(pid)) {
        if (alive(child)) process.kill(child, 'SIGKILL')
      }
    }
  }
  const leftovers = Object.entries(PORTS).filter(([, port]) => state && Object.values(state.pids).flatMap(descendants).includes(listener(port)))
  rmSync(RUN, { recursive: true, force: true })
  const yourDataUntouched = state ? JSON.stringify(fingerprint(USER_DATA)) === JSON.stringify(state.userData) : null
  return {
    ok: yourDataUntouched !== false && skipped.length === 0,
    stopped, skipped, leftovers: leftovers.map(([role]) => role),
    yourDataUntouched,
    ...(yourDataUntouched === false ? { problem: 'data/projects.json changed while the instance ran. Something wrote to real data; report it to the owner.' } : {}),
    evidenceKept: state?.evidence ?? null,
  }
}

function requireState() {
  const state = readState()
  if (!state) throw new UsageError('No instance is running. Run "up" first.')
  return state
}

async function connect() {
  const { chromium } = await import('playwright-core')
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORTS.cdp}`)
  const context = browser.contexts()[0]
  const page = context.pages().find((candidate) => candidate.url().startsWith(WEB)) ?? context.pages()[0] ?? await context.newPage()
  return { browser, page }
}

function locate(page, values) {
  let scope = values.within ? page.locator(values.within) : page
  if (values.within && (values.role || values.label || values.text)) scope = scope.first()
  const exact = Boolean(values.exact)
  let locator
  if (values.role) locator = scope.getByRole(values.role, values.name ? { name: values.name, exact } : {})
  else if (values.label) locator = scope.getByLabel(values.label, { exact })
  else if (values.text) locator = scope.getByText(values.text, { exact })
  else if (values.css) locator = scope.locator(values.css)
  else return null
  return values.nth !== undefined ? locator.nth(Number(values.nth)) : locator
}

async function resolveTarget(page, values) {
  const locator = locate(page, values)
  if (!locator) throw new UsageError('This command needs a TARGET: --role/--name, --label, --text, or --css.')
  const count = await locator.count()
  if (count === 0) throw new UsageError(`No element matches ${describe(values)}. Run "snapshot" to see the names on screen.`)
  if (count > 1 && values.nth === undefined) throw new UsageError(`${count} elements match ${describe(values)}. Add --within, --exact, or --nth.`)
  return locator.first()
}

const describe = (values) => ['role', 'name', 'label', 'text', 'css', 'within', 'nth'].filter((key) => values[key] !== undefined).map((key) => `--${key} ${JSON.stringify(values[key])}`).join(' ')

async function settle(page) {
  await page.waitForLoadState('load')
  await page.waitForFunction(() => document.querySelector('.save-indicator')?.dataset.state !== 'saving', null, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(150)
  return page.evaluate(() => ({
    url: location.pathname + location.search,
    saveState: document.querySelector('.save-indicator')?.dataset.state ?? null,
    alert: document.querySelector('[role="alert"]')?.textContent ?? null,
  }))
}

async function setViewport(page, name) {
  const size = VIEWPORTS[name]
  if (!size) throw new UsageError(`Unknown viewport "${name}". Use one of: ${Object.keys(VIEWPORTS).join(', ')}.`)
  const session = await page.context().newCDPSession(page)
  const { windowId } = await session.send('Browser.getWindowForTarget')
  await session.send('Browser.setWindowBounds', { windowId, bounds: { width: size[0], height: size[1] } })
  const [innerWidth, innerHeight] = await page.evaluate(() => [innerWidth, innerHeight])
  await session.send('Browser.setWindowBounds', { windowId, bounds: { width: 2 * size[0] - innerWidth, height: 2 * size[1] - innerHeight } })
  await session.detach()
  return await page.evaluate(() => [innerWidth, innerHeight])
}

async function browserCommand(command, positional, values) {
  const state = requireState()
  const { browser, page } = await connect()
  const consoleErrors = []
  const dialogs = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(String(error)))
  page.on('response', (response) => {
    if (response.status() >= 400) consoleErrors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`)
  })
  page.on('dialog', async (dialog) => {
    dialogs.push({ message: dialog.message(), answered: values.dialog === 'accept' ? 'accept' : 'dismiss' })
    if (values.dialog === 'accept') await dialog.accept()
    else await dialog.dismiss()
  })
  try {
    const result = {}
    if (command === 'open') {
      if (values.viewport) result.viewport = await setViewport(page, values.viewport)
      await page.goto(new URL(positional[0] ?? '/', WEB).href)
      await page.waitForSelector('.loading-message[role="status"]', { state: 'detached', timeout: 15000 }).catch(() => {})
    } else if (command === 'click') {
      await (await resolveTarget(page, values)).click(values.right ? { button: 'right' } : {})
    } else if (command === 'fill') {
      if (values.value === undefined) throw new UsageError('fill needs --value TEXT.')
      await (await resolveTarget(page, values)).fill(values.value)
    } else if (command === 'press') {
      if (!positional[0]) throw new UsageError('press needs a KEY, e.g. Enter, Escape, Meta+Enter, Meta+KeyK.')
      if (locate(page, values)) await (await resolveTarget(page, values)).press(positional[0])
      else await page.keyboard.press(positional[0])
    } else if (command === 'upload') {
      if (!values.file) throw new UsageError('upload needs --file PATH.')
      const file = path.resolve(values.file)
      if (!existsSync(file)) throw new UsageError(`${file} does not exist. The skill ships fixtures/upload.png for this.`)
      const [chooser] = await Promise.all([page.waitForEvent('filechooser', { timeout: 5000 }), (await resolveTarget(page, values)).click()])
      await chooser.setFiles(file)
      await page.waitForFunction(() => !document.querySelector('.upload-status'), null, { timeout: 30000 })
    } else if (command === 'reload') {
      await page.reload()
    } else if (command === 'snapshot') {
      const target = locate(page, values) ? await resolveTarget(page, values) : page.locator('body')
      result.snapshot = await target.ariaSnapshot()
    } else if (command === 'screenshot') {
      if (!positional[0]) throw new UsageError('screenshot needs a NAME, e.g. screenshot todo-after-reload.')
      result.file = path.join(state.evidence, `${positional[0].replace(/[^\w-]/g, '_')}.png`)
      await page.screenshot({ path: result.file, fullPage: Boolean(values.full) })
    } else if (command === 'eval') {
      if (!positional[0]) throw new UsageError('eval needs a JS expression.')
      result.value = await page.evaluate(positional[0])
    }
    Object.assign(result, await settle(page))
    const missingImage = (text) => state.realData && /\/api\/files\/|Failed to load resource: .*404/.test(text)
    const problems = [
      ...consoleErrors.filter((text) => !missingImage(text)).map((text) => `console: ${text}`),
      ...(result.saveState === 'failed' ? ['save failed ("Not saved" shown)'] : []),
      ...(result.alert ? [`error banner: ${result.alert}`] : []),
    ]
    const ignored = consoleErrors.filter(missingImage).length
    return { ok: problems.length === 0, problems, ...result, dialogs, consoleErrors, ...(ignored ? { ignoredMissingImages: ignored } : {}) }
  } finally {
    await browser.close()
  }
}

async function webkitShot(positional, values) {
  const state = requireState()
  if (!positional[0]) throw new UsageError('webkit-shot needs a NAME.')
  const { webkit, devices } = await import('playwright-core')
  const device = devices[values.portrait ? 'iPad Pro 11' : 'iPad Pro 11 landscape']
  requireBrowser(webkit, 'WebKit')
  const browser = await webkit.launch()
  try {
    const page = await (await browser.newContext(device)).newPage()
    const consoleErrors = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', (error) => consoleErrors.push(String(error)))
    await page.goto(new URL(positional[1] ?? '/', WEB).href)
    await page.waitForSelector('.loading-message[role="status"]', { state: 'detached', timeout: 15000 }).catch(() => {})
    const file = path.join(state.evidence, `${positional[0].replace(/[^\w-]/g, '_')}.png`)
    await page.screenshot({ path: file })
    return { file, engine: 'WebKit', viewport: device.viewport, caveat: 'Emulated iPad; not a real device', consoleErrors }
  } finally {
    await browser.close()
  }
}

async function baselineDiff() {
  const state = requireState()
  if (!state.realData) throw new UsageError('baseline-diff needs an instance started with "up --from-real-data".')
  const head = JSON.parse(readFileSync(path.join(RUN, 'baseline/head.json'), 'utf8'))
  const now = await (await fetch(`http://127.0.0.1:${PORTS.api}/api/projects`)).json()
  const byId = (list) => new Map((list ?? []).map((entry) => [entry.id, entry]))
  const compare = (before, after) => {
    const [a, b] = [byId(before), byId(after)]
    return {
      missing: [...a.keys()].filter((id) => !b.has(id)),
      added: [...b.keys()].filter((id) => !a.has(id)),
      changed: [...a.keys()].filter((id) => b.has(id) && JSON.stringify(a.get(id)) !== JSON.stringify(b.get(id))),
    }
  }
  const nowById = byId(now)
  const projects = head.map((project) => {
    const current = nowById.get(project.id)
    if (!current) return { id: project.id, missing: true }
    const fields = Object.fromEntries(['todos', 'items', 'boards'].map((field) => [field, compare(project[field], current[field])]))
    const meta = ['title', 'description'].filter((field) => project[field] !== current[field])
    return { id: project.id, ...(meta.length ? { changedFields: meta } : {}), ...fields }
  })
  const lists = ['todos', 'items', 'boards']
  const lost = projects.some((project) => project.missing || lists.some((field) => project[field].missing.length))
  const differs = projects.filter((project) => project.missing || project.changedFields || lists.some((field) => Object.values(project[field]).some((ids) => ids.length)))
  return {
    ok: !lost,
    addedProjects: now.filter((project) => !head.some((entry) => entry.id === project.id)).map((project) => project.id),
    projects: differs,
    unchanged: projects.length - differs.length,
    ...(lost ? { problem: 'Records HEAD could read are missing now. Treat as data loss unless the change removes them on purpose.' } : {}),
  }
}

function data(values) {
  const file = path.join(requireState() && RUN, 'data/projects.json')
  const projects = JSON.parse(readFileSync(file, 'utf8'))
  return { file, projects: values.project ? projects.filter((project) => project.id === values.project) : projects }
}

async function main() {
  const { values, positionals } = parseArgs({ options: OPTIONS, allowPositionals: true, strict: true })
  const [command, ...rest] = positionals
  if (!command || values.help) return console.log(HELP)
  let result
  if (command === 'up') result = await up(values)
  else if (command === 'doctor') result = await doctor()
  else if (command === 'down') result = await down()
  else if (command === 'data') result = data(values)
  else if (command === 'baseline-diff') result = await baselineDiff()
  else if (command === 'webkit-shot') result = await webkitShot(rest, values)
  else if (['open', 'click', 'fill', 'press', 'upload', 'reload', 'snapshot', 'screenshot', 'eval'].includes(command)) result = await browserCommand(command, rest, values)
  else throw new UsageError(`Unknown command "${command}". Run --help.`)
  const ok = result.ok ?? true
  const output = { ok, command, ...result }
  const evidence = readState()?.evidence ?? result.evidenceKept
  if (evidence && command !== 'data') appendFileSync(path.join(evidence, 'commands.jsonl'), JSON.stringify({ at: new Date().toISOString(), argv: process.argv.slice(2), ...output, snapshot: undefined }) + '\n')
  console.log(command === 'snapshot' ? `${JSON.stringify({ ...output, snapshot: undefined })}\n${result.snapshot}` : JSON.stringify(output, null, 2))
  if (!ok) process.exitCode = 1
}

main().catch((error) => {
  console.log(JSON.stringify({ ok: false, error: error.message.split('\n')[0], ...(error instanceof UsageError ? {} : { next: 'Run "doctor". If it fails, "down" then "up".' }) }, null, 2))
  process.exitCode = 1
})
