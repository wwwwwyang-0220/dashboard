import express from 'express'
import path from 'node:path'

import { embeddingIndex } from './embedding-index.js'
import { ocrIndex } from './ocr-index.js'
import {
  filesDir,
  imageFilePattern,
  imageTypes,
  listProjects,
  ProjectStoreError,
  saveImage,
  updateProject,
  updateProjectBoards,
  updateProjectItems,
  updateProjectTodos,
} from './project-store.js'
import { quickSearch, searchProjects } from './search.js'

const app = express()
const host = '127.0.0.1'
const port = Number(process.env.API_PORT ?? 3001)
// Only the closest images join the keyword results, and only above a similarity floor. On the test
// figures, intended images scored 0.66–0.71 and unrelated or absent-figure queries at most 0.59; recalibrate
// the floor if relevant images start going missing as the library grows.
const SEMANTIC_CANDIDATES = 10
const SEMANTIC_MIN_SIMILARITY = 0.6

app.disable('x-powered-by')
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/projects', async (_request, response) => {
  response.json(await listProjects())
})

app.get('/api/search', async (request, response) => {
  const query = request.query.q
  if (typeof query !== 'string' || query.length > 120) {
    response.status(400).json({ error: 'Search query must be at most 120 characters' })
    return
  }
  const projects = await listProjects()
  const ocr = await ocrIndex.sync(projects)
  if (request.query.mode === 'quick') {
    response.json(quickSearch(projects, query, 5, ocrIndex.records))
    return
  }
  const embeddings = await embeddingIndex.sync(projects)
  let semanticFiles = []
  let semantic = 'ok'
  if (query.trim()) {
    try {
      semanticFiles = embeddingIndex.rank(await embeddingIndex.embedQuery(query), SEMANTIC_CANDIDATES, SEMANTIC_MIN_SIMILARITY)
    } catch (error) {
      semantic = 'unavailable'
      console.warn('Semantic search unavailable:', error.message)
    }
  }
  response.json({
    ...searchProjects(projects, query, 60, ocrIndex.records, semanticFiles),
    indexing: { ocr, embeddings, pending: ocr.pending + embeddings.pending },
    semantic,
  })
})

app.get('/api/search/index', async (_request, response) => {
  const projects = await listProjects()
  response.json({ ocr: await ocrIndex.sync(projects), embeddings: await embeddingIndex.sync(projects) })
})

app.post('/api/search/rebuild', async (_request, response) => {
  const projects = await listProjects()
  response.status(202).json({ ocr: await ocrIndex.sync(projects, { force: true }), embeddings: await embeddingIndex.sync(projects, { force: true }) })
})

app.put('/api/projects/:id', async (request, response) => {
  const project = await updateProject(request.params.id, request.body)
  response.json(project)
})

app.put('/api/projects/:id/todos', async (request, response) => {
  response.json(await updateProjectTodos(request.params.id, request.body?.todos))
})

app.put('/api/projects/:id/items', async (request, response) => {
  const project = await updateProjectItems(request.params.id, request.body?.items)
  const projects = await listProjects()
  await ocrIndex.sync(projects)
  await embeddingIndex.sync(projects)
  response.json(project)
})

app.put('/api/projects/:id/boards', async (request, response) => {
  response.json(await updateProjectBoards(request.params.id, request.body?.boards))
})

app.post(
  '/api/projects/:id/images',
  express.raw({ type: Object.keys(imageTypes), limit: '25mb' }),
  async (request, response) => {
    const contentType = request.get('Content-Type')?.split(';')[0].trim()
    response.status(201).json(await saveImage(request.params.id, request.body, contentType))
  },
)

app.get('/api/files/:name', (request, response, next) => {
  if (!imageFilePattern.test(request.params.name)) {
    response.status(404).end()
    return
  }
  response.sendFile(path.join(filesDir, request.params.name), {
    headers: { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=31536000, immutable' },
  }, (error) => {
    if (error && !response.headersSent) response.status(404).end()
    else if (error) next(error)
  })
})

app.use((error, _request, response, _next) => {
  if (error instanceof ProjectStoreError) {
    response.status(error.statusCode).json({ error: error.message })
    return
  }

  if (error?.type === 'entity.parse.failed') {
    response.status(400).json({ error: 'Request body must be valid JSON' })
    return
  }

  if (error?.type === 'entity.too.large') {
    response.status(413).json({ error: 'Upload is too large' })
    return
  }

  console.error(error)
  response.status(500).json({ error: 'Internal server error' })
})

app.listen(port, host, () => {
  console.log(`Project API listening on http://${host}:${port}`)
  listProjects()
    .then(async (projects) => {
      await ocrIndex.sync(projects)
      await embeddingIndex.sync(projects)
      searchProjects(projects, '', 0, ocrIndex.records)
    })
    .catch((error) => console.error('Could not start search indexing:', error))
})
