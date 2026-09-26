import express from 'express'
import path from 'node:path'

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
import { searchProjects } from './search.js'

const app = express()
const host = '127.0.0.1'
const port = Number(process.env.API_PORT ?? 3001)

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
  const indexing = await ocrIndex.sync(projects)
  response.json({ ...searchProjects(projects, query, 60, ocrIndex.records), indexing })
})

app.get('/api/search/index', async (_request, response) => {
  response.json(await ocrIndex.sync(await listProjects()))
})

app.post('/api/search/rebuild', async (_request, response) => {
  response.status(202).json(await ocrIndex.sync(await listProjects(), { force: true }))
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
  await ocrIndex.sync(await listProjects())
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
  listProjects().then((projects) => ocrIndex.sync(projects)).catch((error) => console.error('Could not start OCR indexing:', error))
})
