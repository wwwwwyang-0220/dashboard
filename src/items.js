export function imageUrl(item) {
  return `/api/files/${encodeURIComponent(item.file)}`
}

// Quick notes often have no title, so their first line stands in for one.
export function itemTitle(item) {
  return item.title.trim()
    || (item.type === 'note' && item.content.trim().split('\n')[0].slice(0, 80))
    || (item.type === 'image' ? 'Untitled image' : 'Untitled note')
}

export function newNote() {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), type: 'note', title: '', content: '', createdAt: now, updatedAt: now }
}

export function formatDate(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (date.toDateString() === new Date().toDateString()) return 'today'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Reads an image file's pixel size so board cards can open at its aspect ratio.
export function readImageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
      URL.revokeObjectURL(url)
    }
    image.onerror = () => {
      resolve({})
      URL.revokeObjectURL(url)
    }
    image.src = url
  })
}

const DAY = 24 * 60 * 60 * 1000
const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

// Groups items newest first: Today, Yesterday, then one group per day for the
// past week, then one per month. Each item carries the short time or date its
// card shows, since the group heading already names the day.
export function groupByDate(items, now = new Date()) {
  const today = startOfDay(now)
  const dated = items.filter((item) => item.createdAt).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const undated = items.filter((item) => !item.createdAt).reverse()
  const groups = []
  for (const item of dated) {
    const created = new Date(item.createdAt)
    const age = Math.max(0, Math.round((today - startOfDay(created)) / DAY))
    let key, label, detail, when
    if (age < 7) {
      key = `d-${startOfDay(created).toISOString()}`
      label = age === 0 ? 'Today' : age === 1 ? 'Yesterday' : created.toLocaleDateString('en-US', { weekday: 'long' })
      detail = created.toLocaleDateString('en-US', age < 2 ? { weekday: 'long', month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric' })
      when = created.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    } else {
      key = `m-${created.getFullYear()}-${created.getMonth()}`
      label = created.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      detail = ''
      when = created.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }
    if (groups.at(-1)?.key !== key) groups.push({ key, label, detail, entries: [] })
    groups.at(-1).entries.push({ item, when })
  }
  if (undated.length > 0) groups.push({ key: 'earlier', label: 'Earlier', detail: '', entries: undated.map((item) => ({ item, when: '' })) })
  return groups
}

export function boardsWith(project, itemId) {
  return project.boards.filter((board) => board.cards.some((card) => card.itemId === itemId))
}

// Keeps the image files in `files`, dropping byte-identical repeats. A macOS
// clipboard can offer one copied image in several formats, and Safari may pass
// each one to a paste as its own file.
export async function distinctImages(files) {
  const kept = []
  for (const file of [...files].filter((candidate) => candidate.type.startsWith('image/'))) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const repeat = kept.some((other) => other.bytes.length === bytes.length && other.bytes.every((value, index) => value === bytes[index]))
    if (!repeat) kept.push({ file, bytes })
  }
  return kept.map(({ file }) => file)
}
