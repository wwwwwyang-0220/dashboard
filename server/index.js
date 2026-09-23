import express from 'express'

import {
  listProjects,
  ProjectStoreError,
  updateProject,
  updateProjectBlocks,
  updateProjectLayout,
} from './project-store.js'

const app = express()
const host = '127.0.0.1'
const port = Number(process.env.API_PORT ?? 3001)

app.disable('x-powered-by')
app.use(express.json({ limit: '32kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.get('/api/projects', async (_request, response) => {
  response.json(await listProjects())
})

app.put('/api/projects/:id', async (request, response) => {
  const project = await updateProject(request.params.id, request.body)
  response.json(project)
})

app.put('/api/projects/:id/blocks', async (request, response) => {
  const project = await updateProjectBlocks(request.params.id, request.body?.blocks)
  response.json(project)
})

app.put('/api/layout', async (request, response) => {
  const projects = await updateProjectLayout(
    request.body.breakpoint,
    request.body.layout,
  )
  response.json(projects)
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

  console.error(error)
  response.status(500).json({ error: 'Internal server error' })
})

app.listen(port, host, () => {
  console.log(`Project API listening on http://${host}:${port}`)
})
