import MiniSearch from 'minisearch'

const searchable = (value) => String(value ?? '').toLocaleLowerCase()
const segmenter = new Intl.Segmenter(undefined, { granularity: 'word' })
const RRF_K = 60
const stopWords = new Set(['a', 'an', 'and', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'with'])

// Intl.Segmenter splits punctuation-joined labels (FA、Addition) and Chinese runs into words.
const tokenize = (text) => [...segmenter.segment(text)].filter((part) => part.isWordLike).map((part) => part.segment)
const processTerm = (term) => {
  const lower = searchable(term)
  return stopWords.has(lower) ? null : lower
}

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

function documentsFor(projects, ocrRecords) {
  const documents = []
  for (const project of projects) {
    documents.push({ id: `project:${project.id}`, type: 'project', projectId: project.id, projectTitle: project.title, title: project.title, project: '', content: '', snippet: project.description ?? '' })
    for (const item of project.items ?? []) {
      if (item.type !== 'note' && item.type !== 'image') continue
      const title = item.title?.trim() || (item.type === 'note' ? item.content?.trim().split('\n')[0].slice(0, 80) : '') || `Untitled ${item.type}`
      documents.push({
        id: `${project.id}/${item.id}`,
        itemId: item.id,
        type: item.type,
        projectId: project.id,
        projectTitle: project.title,
        title,
        project: project.title,
        content: item.type === 'note' ? item.content ?? '' : ocrRecords[item.file]?.text ?? '',
        ...(item.type === 'image' ? { file: item.file } : {}),
      })
    }
  }
  return documents
}

const sameDocument = (a, b) => a.type === b.type && a.title === b.title && a.project === b.project && a.content === b.content && a.projectTitle === b.projectTitle && a.snippet === b.snippet && a.file === b.file

// An in-memory BM25 index over saved project text. It is derived data: every search reconciles it
// with the projects and OCR records passed in, so it rebuilds after a restart and cannot drift.
export class SearchIndex {
  constructor() {
    this.documents = new Map()
    this.index = new MiniSearch({
      fields: ['title', 'project', 'content'],
      tokenize,
      processTerm,
      searchOptions: {
        boost: { title: 3, project: 2 },
        prefix: (term) => term.length > 1,
        fuzzy: (term) => (term.length > 3 ? 0.2 : false),
      },
    })
  }

  sync(projects, ocrRecords = {}) {
    const next = new Map(documentsFor(projects, ocrRecords).map((document) => [document.id, document]))
    for (const id of this.documents.keys()) {
      if (!next.has(id)) this.index.discard(id)
    }
    for (const [id, document] of next) {
      const current = this.documents.get(id)
      if (!current) this.index.add(document)
      else if (!sameDocument(current, document)) this.index.replace(document)
    }
    this.documents = next
  }

  // Full search merges the BM25 ranking with the semantic image ranking by Reciprocal Rank Fusion;
  // ties go to the better keyword rank, which reflects exact labels and project names. Quick search looks only at titles and project names.
  search(query, limit = 60, { fields, semanticFiles = [] } = {}) {
    const matches = query.trim() ? this.index.search(query, fields ? { fields } : {}) : []
    matches.sort((a, b) => b.score - a.score || this.documents.get(a.id).title.localeCompare(this.documents.get(b.id).title))
    const imageIds = new Map()
    for (const document of this.documents.values()) {
      if (document.type === 'image') imageIds.set(document.file, [...(imageIds.get(document.file) ?? []), document.id])
    }
    const fused = new Map()
    const entry = (id) => {
      if (!fused.has(id)) fused.set(id, { id, score: 0, keywordRank: Infinity, semanticRank: Infinity, terms: [] })
      return fused.get(id)
    }
    matches.forEach(({ id, terms }, rank) => {
      const current = entry(id)
      current.score += 1 / (RRF_K + rank + 1)
      current.terms = terms
      current.keywordRank = rank
    })
    semanticFiles.forEach((file, rank) => {
      for (const id of imageIds.get(file) ?? []) {
        const current = entry(id)
        current.score += 1 / (RRF_K + rank + 1)
        current.semanticRank = rank
      }
    })
    const ranked = [...fused.values()].sort((a, b) => b.score - a.score || a.keywordRank - b.keywordRank || a.semanticRank - b.semanticRank)
    const results = ranked.slice(0, limit).map(({ id, terms }) => {
      const document = this.documents.get(id)
      const matchedInContent = terms.filter((term) => searchable(document.content).includes(term))
      const snippet = document.type === 'project' ? document.snippet
        : document.type === 'note' ? excerpt(document.content, terms)
          : matchedInContent.length ? ocrExcerpt(document.content, matchedInContent) : ''
      return {
        id: document.type === 'project' ? document.projectId : document.itemId,
        type: document.type,
        projectId: document.projectId,
        projectTitle: document.projectTitle,
        title: document.title,
        snippet,
        ...(document.type === 'image' ? { file: document.file } : {}),
      }
    })
    return { results, total: ranked.length }
  }
}

const sharedIndex = new SearchIndex()

export function searchProjects(projects, query, limit = 60, ocrRecords = {}, semanticFiles = []) {
  sharedIndex.sync(projects, ocrRecords)
  if (!query.trim()) return { results: [], total: 0 }
  return sharedIndex.search(query, limit, { semanticFiles })
}

export function quickSearch(projects, query, limit = 5, ocrRecords = {}) {
  sharedIndex.sync(projects, ocrRecords)
  if (!query.trim()) return { results: [], total: 0 }
  return sharedIndex.search(query, limit, { fields: ['title', 'project'] })
}
