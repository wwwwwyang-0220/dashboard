import { execFile } from 'node:child_process'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

import { filesDir, imageFilePattern } from './project-store.js'

const run = promisify(execFile)
const sourceFile = fileURLToPath(new URL('./vision-ocr.swift', import.meta.url))
const indexFile = process.env.SEARCH_INDEX_FILE ?? path.join(path.dirname(filesDir), 'search', 'index.json')
const binaryFile = process.env.OCR_BINARY_FILE ?? path.join(path.dirname(indexFile), 'vision-ocr')
const OCR_VERSION = 1

class OcrIndex {
  constructor() {
    this.records = {}
    this.desired = new Set()
    this.queue = []
    this.queued = new Set()
    this.running = false
    this.writeQueue = Promise.resolve()
    this.loaded = this.load()
  }

  async load() {
    try {
      const saved = JSON.parse(await readFile(indexFile, 'utf8'))
      if (saved.version === 1 && saved.records && typeof saved.records === 'object') this.records = saved.records
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('Could not load OCR index; rebuilding:', error)
    }
  }

  async save() {
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
    }).catch((error) => console.error('Could not save OCR index:', error))
    await this.writeQueue
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
        changed = true
      }
    }
    for (const file of desired) {
      const current = this.records[file]
      if (!current || current.version !== OCR_VERSION || force) {
        this.records[file] = {
          version: OCR_VERSION,
          revision: (current?.revision ?? 0) + 1,
          state: 'pending',
          text: current?.text ?? '',
          lines: current?.lines ?? [],
        }
        changed = true
      }
    }
    if (changed) await this.save()
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
        const lines = await this.recognize(file)
        if (!this.desired.has(file) || this.records[file]?.revision !== revision) continue
        const unique = [...new Set(lines.map((line) => line.text.trim()).filter(Boolean))]
        this.records[file] = { version: OCR_VERSION, revision, state: 'ready', text: unique.join('\n'), lines }
        await this.save()
      } catch (error) {
        if (this.desired.has(file) && this.records[file]?.revision === revision) {
          this.records[file] = { ...this.records[file], state: 'failed', error: error.message }
          await this.save()
        }
      } finally {
        this.queued.delete(key)
      }
    }
    this.running = false
  }

  async recognize(file) {
    await this.ensureBinary()
    const { stdout } = await run(binaryFile, [path.join(filesDir, file)], { timeout: 120000, maxBuffer: 2 * 1024 * 1024 })
    const output = JSON.parse(stdout)
    if (!Array.isArray(output.lines)) throw new Error('OCR returned no text lines')
    return output.lines
  }

  async ensureBinary() {
    if (!this.compilation) {
      this.compilation = (async () => {
        const source = await stat(sourceFile)
        const binary = await stat(binaryFile).catch(() => null)
        if (binary && binary.mtimeMs >= source.mtimeMs) return
        await mkdir(path.dirname(binaryFile), { recursive: true })
        const temporary = `${binaryFile}.${process.pid}.tmp`
        try {
          await run('/usr/bin/swiftc', [sourceFile, '-o', temporary], { timeout: 120000, maxBuffer: 1024 * 1024 })
          await rename(temporary, binaryFile)
        } catch (error) {
          await rm(temporary, { force: true })
          throw error
        }
      })().finally(() => { this.compilation = null })
    }
    await this.compilation
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

export const ocrIndex = new OcrIndex()
