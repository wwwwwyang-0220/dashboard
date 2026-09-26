const searchable = (value) => String(value ?? '').toLocaleLowerCase()

function excerpt(content, terms) {
  const text = content.replace(/\s+/g, ' ').trim()
  if (text.length <= 150) return text
  const lower = searchable(text)
  const positions = terms.map((term) => lower.indexOf(term)).filter((at) => at >= 0)
  const at = positions.length ? Math.min(...positions) : 0
  const start = Math.max(0, at - 45)
  const end = Math.min(text.length, start + 150)
  return `${start ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}

function ocrExcerpt(content, terms) {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean)
  const matches = []
  const wholeMatch = lines.find((line) => terms.every((term) => searchable(line).includes(term)))
  if (wholeMatch) return wholeMatch.slice(0, 150)
  for (const term of terms) {
    const line = lines.find((candidate) => searchable(candidate).includes(term))
    if (line && !matches.includes(line)) matches.push(line)
  }
  return matches.join(' · ').slice(0, 150)
}

export function searchProjects(projects, query, limit = 60, ocrRecords = {}) {
  const terms = searchable(query.trim()).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return { results: [], total: 0 }

  const matches = []
  for (const project of projects) {
    if (terms.every((term) => searchable(project.title).includes(term))) {
      matches.push({ id: project.id, type: 'project', projectId: project.id, projectTitle: project.title, title: project.title, snippet: project.description ?? '', score: 0 })
    }
    for (const item of project.items ?? []) {
      if (item.type !== 'note' && item.type !== 'image') continue
      const title = item.title?.trim() || (item.type === 'note' ? item.content?.trim().split('\n')[0].slice(0, 80) : '') || `Untitled ${item.type}`
      const titleMatch = terms.every((term) => searchable(title).includes(term))
      const content = item.type === 'note' ? item.content ?? '' : ocrRecords[item.file]?.text ?? ''
      const contentMatch = terms.every((term) => searchable(`${item.title} ${content}`).includes(term))
      const bodyMatch = terms.every((term) => searchable(content).includes(term))
      if (!titleMatch && !contentMatch) continue
      matches.push({
        id: item.id,
        type: item.type,
        projectId: project.id,
        projectTitle: project.title,
        title,
        snippet: item.type === 'note' ? excerpt(content, terms) : bodyMatch ? ocrExcerpt(content, terms) : '',
        ...(item.type === 'image' ? { file: item.file } : {}),
        score: titleMatch ? 1 : 2,
      })
    }
  }
  matches.sort((a, b) => a.score - b.score || a.title.localeCompare(b.title))
  return { results: matches.slice(0, limit).map(({ score: _score, ...result }) => result), total: matches.length }
}
