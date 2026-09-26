import { useEffect, useRef, useState } from 'react'
import { Search, Xmark } from 'iconoir-react'
import { Ring } from 'loading-dev'

function ResultButton({ result, compact, onSelect }) {
  return (
    <button type="button" className={`search-result${compact ? ' is-compact' : ''}`} onClick={() => onSelect(result)}>
      {result.type === 'image' && <span className="search-result-thumb"><img src={`/api/files/${encodeURIComponent(result.file)}`} alt="" loading="lazy" /></span>}
      <span className="search-result-copy">
        <span className="search-result-title">{result.title}</span>
        {!compact && result.snippet && <span className="search-result-snippet">{result.snippet}</span>}
        <span className="search-result-meta">{result.type === 'project' ? 'Project' : `${result.type === 'note' ? 'Note' : 'Image'} · ${result.projectTitle}`}</span>
      </span>
    </button>
  )
}

export default function SearchDialog({ onClose, onSelect }) {
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [quick, setQuick] = useState([])
  const [submission, setSubmission] = useState(null)
  const [full, setFull] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
    inputRef.current.focus()
  }, [])

  // Quick matches follow typing: titles and project names only, local and instant.
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?mode=quick&q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        const data = await response.json()
        if (response.ok) setQuick(data.results)
      } catch (quickError) {
        if (quickError.name !== 'AbortError') setQuick([])
      }
    }, 150)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  // Enter runs the full search: keywords, image text, and meaning. It refreshes while images index.
  useEffect(() => {
    if (!submission) return
    const controller = new AbortController()
    let timer
    async function search() {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(submission.query)}`, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Could not search')
        setFull({ ...data, query: submission.query })
        setError('')
        if (data.indexing?.pending) timer = setTimeout(search, 1500)
      } catch (searchError) {
        if (searchError.name !== 'AbortError') setError(searchError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    void search()
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [submission])

  function changeQuery(value) {
    setQuery(value)
    if (!value.trim()) setQuick([])
  }

  function submit(event) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setLoading(true)
    setError('')
    setSubmission({ query: trimmed, at: Date.now() })
  }

  const trimmed = query.trim()
  const showQuick = trimmed && quick.length > 0 && trimmed !== full?.query && trimmed !== submission?.query
  const pending = full?.indexing?.pending ?? 0

  return (
    <dialog
      ref={dialogRef}
      className="search-dialog"
      aria-label="Search projects and library"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <div className="search-dialog-body">
        <form className="search-dialog-bar" role="search" onSubmit={submit}>
          <Search className="ui-icon" aria-hidden="true" />
          <input ref={inputRef} type="search" value={query} maxLength={120} placeholder="Describe a note or figure, then press Enter" aria-label="Search projects, notes, and images" onChange={(event) => changeQuery(event.target.value)} />
          {loading && <Ring size={14} duration={1400} />}
          <button type="submit" className="search-dialog-submit" disabled={!trimmed}>Search <kbd aria-hidden="true">↵</kbd></button>
          <button type="button" className="search-dialog-close" aria-label="Close search" title="Close search" onClick={() => dialogRef.current.close()}><Xmark className="ui-icon" aria-hidden="true" /></button>
        </form>
        <div className="search-dialog-results">
          {!trimmed && !full && !loading && <p className="search-dialog-message">Describe what you’re looking for — a note’s topic or what a figure shows — and press Enter.</p>}
          {loading && !full && <p className="search-dialog-message" role="status">Searching…</p>}
          {showQuick && (
            <section className="search-quick" aria-label="Quick matches">
              <p className="search-dialog-count">Quick matches by title · press Enter to search everything</p>
              {quick.map((result) => <ResultButton key={`${result.type}-${result.projectId}-${result.id}`} result={result} compact onSelect={onSelect} />)}
            </section>
          )}
          {error && <p className="search-dialog-message is-error">{error}</p>}
          {full && !error && (
            <section aria-label={`Results for ${full.query}`} aria-busy={loading}>
              <h2 className="search-dialog-heading">Results for “{full.query}”</h2>
              <p className="search-dialog-count" role="status">
                {full.total} result{full.total === 1 ? '' : 's'}{full.total > full.results.length ? ` · showing first ${full.results.length}` : ''}
                {pending > 0 && ` · indexing ${pending} image${pending === 1 ? '' : 's'}, results will update`}
              </p>
              {full.semantic === 'unavailable' && <p className="search-dialog-note">Search by meaning is unavailable right now, so these are keyword and image-text matches.</p>}
              {full.results.length === 0 && <p className="search-dialog-message">No results for “{full.query}”.</p>}
              {full.results.map((result) => <ResultButton key={`${result.type}-${result.projectId}-${result.id}`} result={result} onSelect={onSelect} />)}
            </section>
          )}
        </div>
      </div>
    </dialog>
  )
}
