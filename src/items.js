export function imageUrl(item) {
  return `/api/files/${encodeURIComponent(item.file)}`
}

export function itemTitle(item) {
  return item.title.trim() || (item.type === 'image' ? 'Untitled image' : 'Untitled note')
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
