import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import { filesDir, imageFilePattern } from './project-store.js'

const run = promisify(execFile)
const searchDir = path.dirname(process.env.SEARCH_INDEX_FILE ?? path.join(path.dirname(filesDir), 'search', 'index.json'))
const indexFile = process.env.EMBEDDING_INDEX_FILE ?? path.join(searchDir, 'embeddings.json')
const MODEL = 'gemini-embedding-2'
const DIMENSIONS = 768
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`
const inlineTypes = { png: 'image/png', jpg: 'image/jpeg' }
const MAX_INLINE_BYTES = 15 * 1024 * 1024
const RETRY_AFTER_MS = 5 * 60 * 1000
const QUERY_TIMEOUT_MS = 2000
const QUERY_CACHE_SIZE = 100

const encodeVector = (vector) => Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength).toString('base64')
const decodeVector = (text) => {
  const bytes = Buffer.from(text, 'base64')
  return new Float32Array(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
}

function normalize(values) {
  const vector = Float32Array.from(values)
  const length = Math.hypot(...vector)
  if (!length) throw new Error('Gemini returned an empty embedding')
  for (let i = 0; i < vector.length; i += 1) vector[i] /= length
  return vector
}

// The key comes from GEMINI_API_KEY, then a 0600 key file, then the macOS Keychain item
// "GEMINI_API_KEY". The file matters when the API runs somewhere the Keychain is locked, such as a
// detached tmux or cron. Without a key, semantic search is unavailable and keyword search carries on.
const keyFile = process.env.GEMINI_API_KEY_FILE ?? path.join(os.homedir(), '.config', 'gemini', 'key')
let keyLookup = null
let keyCheckedAt = 0
function apiKey() {
  if (process.env.GEMINI_API_KEY) return Promise.resolve(process.env.GEMINI_API_KEY)
  if (!keyLookup || Date.now() - keyCheckedAt > RETRY_AFTER_MS) {
    keyCheckedAt = Date.now()
    keyLookup = readFile(keyFile, 'utf8')
      .then((text) => text.trim() || Promise.reject(new Error('empty key file')))
      .catch(() => run('/usr/bin/security', ['find-generic-password', '-s', 'GEMINI_API_KEY', '-w'], { timeout: 5000 })
        .then(({ stdout }) => stdout.trim() || null))
      .catch(() => null)
  }
  return keyLookup
}

async function embed(parts, signal) {
  const key = await apiKey()
  if (!key) throw new Error('No Gemini API key is available')
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ content: { parts }, outputDimensionality: DIMENSIONS }),
    signal,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error?.message ?? `Gemini returned ${response.status}`)
  const values = data.embedding?.values
  if (!Array.isArray(values) || values.length !== DIMENSIONS) throw new Error('Gemini returned no embedding')
  return normalize(values)
}

// Gemini accepts PNG and JPEG; GIF and WebP uploads are converted to PNG with macOS sips first.
async function imagePart(file) {
  const extension = path.extname(file).slice(1).toLowerCase()
  let bytes
  if (inlineTypes[extension]) {
    bytes = await readFile(path.join(filesDir, file))
  } else {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'dashboard-embed-'))
    try {
      const converted = path.join(directory, 'image.png')
      await run('/usr/bin/sips', ['-s', 'format', 'png', path.join(filesDir, file), '--out', converted], { timeout: 60000 })
      bytes = await readFile(converted)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  }
  if (bytes.length > MAX_INLINE_BYTES) throw new Error('Image is too large to embed')
  return { inline_data: { mime_type: inlineTypes[extension] ?? 'image/png', data: bytes.toString('base64') } }
}

class EmbeddingIndex {
  constructor() {
    this.records = {}
    this.vectors = new Map()
    this.desired = new Set()
    this.queue = []
    this.queued = new Set()
    this.running = false
    this.queries = new Map()
    this.saveTimer = null
    this.writeQueue = Promise.resolve()
    this.loaded = this.load()
  }

  async load() {
    try {
      const saved = JSON.parse(await readFile(indexFile, 'utf8'))
      if (saved.version === 1 && saved.records && typeof saved.records === 'object') this.records = saved.records
      for (const [file, record] of Object.entries(this.records)) {
        if (record.state === 'ready' && record.vector) this.vectors.set(file, decodeVector(record.vector))
      }
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('Could not load image embeddings; rebuilding:', error)
    }
  }

  // Coalesce saves so a backfill of many images does not rewrite the file after each one.
  save() {
    if (this.saveTimer) return
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      const contents = `${JSON.stringify({ version: 1, records: this.records })}\n`
      this.writeQueue = this.writeQueue.then(async () => {
        await mkdir(path.dirname(indexFile), { recursive: true })
        const temporary = `${indexFile}.${process.pid}.${Date.now()}.tmp`
        try {
          await writeFile(temporary, contents, { mode: 0o600 })
          await rename(temporary, indexFile)
        } catch (error) {
          await rm(temporary, { force: true })
          throw error
        }
      }).catch((error) => console.error('Could not save image embeddings:', error))
    }, 1000)
  }

  async sync(projects, { force = false } = {}) {
    await this.loaded
    const desired = new Set(projects.flatMap((project) => (project.items ?? [])
      .filter((item) => item.type === 'image' && imageFilePattern.test(item.file))
      .map((item) => item.file)))
    this.desired = desired
    let changed = false
    for (const file of Object.keys(this.records)) {
      if (!desired.has(file)) {
        delete this.records[file]
        this.vectors.delete(file)
        changed = true
      }
    }
    for (const file of desired) {
      const current = this.records[file]
      const stale = !current || current.model !== MODEL || current.dimensions !== DIMENSIONS
      const retry = current?.state === 'failed' && Date.now() - (current.failedAt ?? 0) > RETRY_AFTER_MS
      if (stale || retry || force) {
        this.records[file] = { model: MODEL, dimensions: DIMENSIONS, revision: (current?.revision ?? 0) + 1, state: 'pending' }
        if (stale) this.vectors.delete(file)
        changed = true
      }
    }
    if (changed) this.save()
    for (const file of desired) {
      const record = this.records[file]
      if (record.state === 'pending') this.schedule(file, record.revision)
    }
    return this.status()
  }

  schedule(file, revision) {
    const key = `${file}:${revision}`
    if (this.queued.has(key)) return
    this.queued.add(key)
    this.queue.push({ file, revision, key })
    void this.process()
  }

  async process() {
    if (this.running) return
    this.running = true
    while (this.queue.length) {
      const { file, revision, key } = this.queue.shift()
      try {
        if (!this.desired.has(file) || this.records[file]?.revision !== revision) continue
        const vector = await embed([await imagePart(file)], AbortSignal.timeout(60000))
        if (!this.desired.has(file) || this.records[file]?.revision !== revision) continue
        this.records[file] = { model: MODEL, dimensions: DIMENSIONS, revision, state: 'ready', vector: encodeVector(vector) }
        this.vectors.set(file, vector)
        this.save()
      } catch (error) {
        if (this.desired.has(file) && this.records[file]?.revision === revision) {
          this.records[file] = { ...this.records[file], state: 'failed', error: error.message, failedAt: Date.now() }
          this.save()
        }
      } finally {
        this.queued.delete(key)
      }
    }
    this.running = false
  }

  // Embeds a search query once and caches it, so polling and repeated searches cost nothing.
  async embedQuery(query) {
    const text = query.trim()
    if (this.queries.has(text)) {
      const vector = this.queries.get(text)
      this.queries.delete(text)
      this.queries.set(text, vector)
      return vector
    }
    const vector = await embed([{ text: `task: search result | query: ${text}` }], AbortSignal.timeout(QUERY_TIMEOUT_MS))
    this.queries.set(text, vector)
    if (this.queries.size > QUERY_CACHE_SIZE) this.queries.delete(this.queries.keys().next().value)
    return vector
  }

  // Image files at least minScore similar to the query, closest first (vectors are unit length).
  rank(queryVector, limit, minScore) {
    const scored = []
    for (const file of this.desired) {
      const vector = this.vectors.get(file)
      if (!vector) continue
      let score = 0
      for (let i = 0; i < vector.length; i += 1) score += vector[i] * queryVector[i]
      if (score >= minScore) scored.push({ file, score })
    }
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, limit).map(({ file }) => file)
  }

  status() {
    const status = { pending: 0, ready: 0, failed: 0 }
    for (const file of this.desired) {
      const state = this.records[file]?.state
      status[state === 'ready' || state === 'failed' ? state : 'pending'] += 1
    }
    return status
  }
}

export const embeddingIndex = new EmbeddingIndex()
