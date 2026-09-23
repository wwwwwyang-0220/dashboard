import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dataFile = fileURLToPath(
  new URL('../data/projects.json', import.meta.url),
)
const allowedStatuses = new Set(['active', 'planned', 'paused', 'completed'])
const allowedBreakpoints = new Set(['desktop', 'tablet', 'mobile'])
const layoutFields = ['x', 'y', 'w', 'h']

let writeQueue = Promise.resolve()

export class ProjectStoreError extends Error {
  constructor(message, statusCode) {
    super(message)
    this.name = 'ProjectStoreError'
    this.statusCode = statusCode
  }
}

export async function listProjects() {
  const contents = await readFile(dataFile, 'utf8')
  const projects = JSON.parse(contents)

  if (!Array.isArray(projects)) {
    throw new Error('Project data must be a JSON array')
  }

  return projects.map(normalizeProjectLayouts)
}

export function updateProject(id, input) {
  const operation = writeQueue.then(async () => {
    const projects = await listProjects()
    const projectIndex = projects.findIndex((project) => project.id === id)

    if (projectIndex === -1) {
      throw new ProjectStoreError('Project not found', 404)
    }

    const updatedProject = {
      ...projects[projectIndex],
      title: validateText(input.title, 'title', 120),
      description: validateText(input.description, 'description', 1000),
      status: validateStatus(input.status),
    }

    projects[projectIndex] = updatedProject
    await writeProjectsAtomically(projects)

    return updatedProject
  })

  writeQueue = operation.catch(() => {})
  return operation
}

export function updateProjectLayout(breakpoint, input) {
  const operation = writeQueue.then(async () => {
    const projects = await listProjects()

    if (!allowedBreakpoints.has(breakpoint)) {
      throw new ProjectStoreError('Invalid layout breakpoint', 400)
    }

    if (!Array.isArray(input)) {
      throw new ProjectStoreError('layout must be an array', 400)
    }

    if (input.length !== projects.length) {
      throw new ProjectStoreError('layout must include every project', 400)
    }

    const layoutById = new Map()

    for (const item of input) {
      if (typeof item?.i !== 'string' || layoutById.has(item.i)) {
        throw new ProjectStoreError('layout contains an invalid project id', 400)
      }

      layoutById.set(item.i, validateLayout(item))
    }

    const updatedProjects = projects.map((project) => {
      const layout = layoutById.get(project.id)

      if (!layout) {
        throw new ProjectStoreError(`layout is missing project ${project.id}`, 400)
      }

      return {
        ...project,
        layouts: {
          ...project.layouts,
          [breakpoint]: layout,
        },
      }
    })

    await writeProjectsAtomically(updatedProjects)
    return updatedProjects
  })

  writeQueue = operation.catch(() => {})
  return operation
}

function normalizeProjectLayouts(project, index) {
  if (project.layouts) {
    return project
  }

  const desktop = project.layout ?? {
    x: (index * 4) % 12,
    y: Math.floor(index / 3) * 5,
    w: 4,
    h: 5,
  }

  return {
    ...project,
    layouts: {
      desktop,
      tablet: {
        x: index === 1 ? 0 : index === 0 ? 0 : 6,
        y: index === 1 ? 0 : 5,
        w: index === 1 ? 12 : 6,
        h: index === 1 ? 5 : 4,
      },
      mobile: {
        x: 0,
        y: index * 5,
        w: 4,
        h: 5,
      },
    },
  }
}

function validateText(value, fieldName, maximumLength) {
  if (typeof value !== 'string') {
    throw new ProjectStoreError(`${fieldName} must be a string`, 400)
  }

  const normalizedValue = value.trim()

  if (normalizedValue.length === 0) {
    throw new ProjectStoreError(`${fieldName} cannot be empty`, 400)
  }

  if (normalizedValue.length > maximumLength) {
    throw new ProjectStoreError(
      `${fieldName} cannot exceed ${maximumLength} characters`,
      400,
    )
  }

  return normalizedValue
}

function validateStatus(value) {
  if (!allowedStatuses.has(value)) {
    throw new ProjectStoreError('Invalid project status', 400)
  }

  return value
}

function validateLayout(value) {
  const layout = {}

  for (const field of layoutFields) {
    if (!Number.isInteger(value[field])) {
      throw new ProjectStoreError(`layout ${field} must be an integer`, 400)
    }

    layout[field] = value[field]
  }

  if (layout.x < 0 || layout.y < 0) {
    throw new ProjectStoreError('layout position cannot be negative', 400)
  }

  if (layout.w < 3 || layout.w > 12 || layout.x + layout.w > 12) {
    throw new ProjectStoreError('layout width is outside the grid', 400)
  }

  if (layout.h < 4 || layout.h > 12) {
    throw new ProjectStoreError('layout height is outside the allowed range', 400)
  }

  return layout
}

async function writeProjectsAtomically(projects) {
  await mkdir(path.dirname(dataFile), { recursive: true })

  const temporaryFile = `${dataFile}.${process.pid}.${Date.now()}.tmp`
  const serializedProjects = `${JSON.stringify(projects, null, 2)}\n`

  try {
    await writeFile(temporaryFile, serializedProjects, {
      encoding: 'utf8',
      mode: 0o600,
    })
    await rename(temporaryFile, dataFile)
  } catch (error) {
    await rm(temporaryFile, { force: true })
    throw error
  }
}
