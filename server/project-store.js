import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dataFile = process.env.PROJECTS_DATA_FILE ?? fileURLToPath(
  new URL('../data/projects.json', import.meta.url),
)
export const filesDir = path.resolve(process.env.PROJECTS_FILES_DIR ?? path.join(path.dirname(dataFile), 'files'))

export const BOARD_COLUMNS = 24
const idPattern = /^[a-zA-Z0-9-]{1,80}$/
export const imageFilePattern = /^[a-f0-9-]{36}\.(png|jpg|gif|webp)$/
export const imageTypes = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

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

  return projects.map(migrateProject)
}

export function updateProject(id, input) {
  return updateStoredProject(id, (project) => ({
    ...project,
    title: validateText(input.title, 'title', 120),
    description: validateText(input.description, 'description', 1000),
  }))
}

export function updateProjectTodos(id, input) {
  return updateStoredProject(id, (project) => ({ ...project, todos: validateTodos(input) }))
}

export function updateProjectBoards(id, input) {
  return updateStoredProject(id, (project) => ({ ...project, boards: validateBoards(input) }))
}

export async function updateProjectItems(id, input) {
  let removedFiles = []
  const project = await updateStoredProject(id, async (current) => {
    const items = validateItems(input)
    const nextFiles = new Set(items.filter((item) => item.type === 'image').map((item) => item.file))
    for (const file of nextFiles) {
      if (!current.items.some((item) => item.file === file) && !(await fileExists(file))) {
        throw new ProjectStoreError('Image file was not uploaded', 400)
      }
    }
    removedFiles = current.items
      .filter((item) => item.type === 'image' && !nextFiles.has(item.file))
      .map((item) => item.file)
    return { ...current, items }
  })
  await Promise.all(removedFiles.map((file) => rm(path.join(filesDir, file), { force: true })))
  return project
}

export async function saveImage(id, buffer, contentType) {
  const extension = imageTypes[contentType]
  if (!extension) {
    throw new ProjectStoreError('Images must be PNG, JPEG, GIF, or WebP', 415)
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ProjectStoreError('Image is empty', 400)
  }
  const projects = await listProjects()
  if (!projects.some((project) => project.id === id)) {
    throw new ProjectStoreError('Project not found', 404)
  }
  const file = `${randomUUID()}.${extension}`
  await mkdir(filesDir, { recursive: true })
  await writeFile(path.join(filesDir, file), buffer, { mode: 0o600 })
  return { file }
}

function updateStoredProject(id, change) {
  const operation = writeQueue.then(async () => {
    const projects = await listProjects()
    const projectIndex = projects.findIndex((project) => project.id === id)

    if (projectIndex === -1) {
      throw new ProjectStoreError('Project not found', 404)
    }

    const updatedProject = await change(projects[projectIndex])
    projects[projectIndex] = updatedProject
    await writeProjectsAtomically(projects)
    return updatedProject
  })

  writeQueue = operation.catch(() => {})
  return operation
}

// Projects saved before the library existed keep their `blocks` and `layouts`
// fields untouched; their checklist items become to-dos and their text and
// reference blocks become notes. Derived ids are stable so repeated reads agree.
function migrateProject(project) {
  const migrated = { ...project }
  delete migrated.status
  const blocks = Array.isArray(project.blocks) ? project.blocks : []

  if (!Array.isArray(migrated.todos)) {
    migrated.todos = blocks
      .filter((block) => block.type === 'checklist')
      .flatMap((block) => (block.items ?? []).map((item, index) => ({
        id: `${block.id}-${index}`,
        text: String(item.text ?? '').trim(),
        done: Boolean(item.done),
        doneAt: null,
      })))
      .filter((todo) => todo.text)
  }

  if (!Array.isArray(migrated.items)) {
    migrated.items = blocks
      .filter((block) => block.type === 'text' || block.type === 'references')
      .map((block) => ({
        id: block.id,
        type: 'note',
        title: block.title ?? '',
        content: block.type === 'text'
          ? block.content ?? ''
          : (block.items ?? []).map((item, index) => `${index + 1}. ${item.text}`).join('\n'),
        createdAt: null,
        updatedAt: null,
      }))
  }

  if (!Array.isArray(migrated.boards)) {
    migrated.boards = []
  }

  return migrated
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

function validateString(value, fieldName, maximumLength) {
  if (typeof value !== 'string' || value.length > maximumLength) {
    throw new ProjectStoreError(`${fieldName} must be a string of at most ${maximumLength} characters`, 400)
  }
  return value
}

function validateTimestamp(value, fieldName) {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || value.length > 40 || Number.isNaN(Date.parse(value))) {
    throw new ProjectStoreError(`${fieldName} must be a date`, 400)
  }
  return value
}

function validateArray(value, fieldName, maximumLength) {
  if (!Array.isArray(value) || value.length > maximumLength) {
    throw new ProjectStoreError(`${fieldName} must be an array of at most ${maximumLength} entries`, 400)
  }
  return value
}

function validateId(value, ids, fieldName) {
  if (typeof value !== 'string' || !idPattern.test(value) || ids.has(value)) {
    throw new ProjectStoreError(`Invalid or duplicate ${fieldName}`, 400)
  }
  ids.add(value)
  return value
}

function validateTodos(input) {
  const ids = new Set()
  return validateArray(input, 'todos', 500).map((todo) => {
    if (typeof todo?.done !== 'boolean') {
      throw new ProjectStoreError('todo done must be a boolean', 400)
    }
    return {
      id: validateId(todo.id, ids, 'todo id'),
      text: validateString(todo.text, 'todo text', 500),
      done: todo.done,
      doneAt: validateTimestamp(todo.doneAt, 'todo doneAt'),
    }
  })
}

function validateItems(input) {
  const ids = new Set()
  return validateArray(input, 'items', 500).map((item) => {
    const base = {
      id: validateId(item?.id, ids, 'item id'),
      type: item.type,
      title: validateString(item.title, 'item title', 120),
      createdAt: validateTimestamp(item.createdAt, 'item createdAt'),
      updatedAt: validateTimestamp(item.updatedAt, 'item updatedAt'),
    }
    if (item.type === 'note') {
      return { ...base, content: validateString(item.content, 'note content', 20000) }
    }
    if (item.type === 'image') {
      if (typeof item.file !== 'string' || !imageFilePattern.test(item.file)) {
        throw new ProjectStoreError('Invalid image file', 400)
      }
      const size = {}
      for (const field of ['width', 'height']) {
        if (item[field] !== undefined && item[field] !== null) {
          if (!Number.isInteger(item[field]) || item[field] < 1 || item[field] > 100000) {
            throw new ProjectStoreError(`Invalid image ${field}`, 400)
          }
          size[field] = item[field]
        }
      }
      return { ...base, file: item.file, ...size }
    }
    throw new ProjectStoreError('Invalid item type', 400)
  })
}

function validateBoards(input) {
  const ids = new Set()
  return validateArray(input, 'boards', 50).map((board) => {
    const itemIds = new Set()
    return {
      id: validateId(board?.id, ids, 'board id'),
      name: validateText(board.name, 'board name', 120),
      updatedAt: validateTimestamp(board.updatedAt, 'board updatedAt'),
      cards: validateArray(board.cards, 'board cards', 60).map((card) => {
        const itemId = validateId(card?.itemId, itemIds, 'card item id')
        const position = {}
        for (const field of ['x', 'y', 'w', 'h']) {
          if (!Number.isInteger(card[field])) {
            throw new ProjectStoreError(`card ${field} must be an integer`, 400)
          }
          position[field] = card[field]
        }
        const { x, y, w, h } = position
        if (x < 0 || w < 3 || x + w > BOARD_COLUMNS || y < 0 || y > 2000 || h < 4 || h > 80) {
          throw new ProjectStoreError('card is outside the board grid', 400)
        }
        return { itemId, ...position }
      }),
    }
  })
}

async function fileExists(file) {
  try {
    return (await stat(path.join(filesDir, file))).isFile()
  } catch {
    return false
  }
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
