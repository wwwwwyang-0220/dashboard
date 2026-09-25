import { useEffect, useRef, useState } from 'react'
import { Search, Xmark } from 'iconoir-react'
import { Ring } from 'loading-dev'

export default function SearchDialog({ onClose, onSelect }) {
  const dialogRef = useRef(null)
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
    inputRef.current.focus()
  }, [])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) return
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Could not search')
        setResults(data.results)
        setTotal(data.total)
        setError('')
      } catch (searchError) {
        if (searchError.name !== 'AbortError') setError(searchError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 180)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  function changeQuery(value) {
    setQuery(value)
    setResults([])
    setTotal(0)
    setError('')
    setLoading(Boolean(value.trim()))
  }

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
        <div className="search-dialog-bar">
          <Search className="ui-icon" aria-hidden="true" />
          <input ref={inputRef} type="search" value={query} maxLength={120} placeholder="Search projects, notes, and images" aria-label="Search projects, notes, and images" onChange={(event) => changeQuery(event.target.value)} />
          {loading && <Ring size={14} duration={1400} />}
          <button type="button" className="search-dialog-close" aria-label="Close search" title="Close search" onClick={() => dialogRef.current.close()}><Xmark className="ui-icon" aria-hidden="true" /></button>
        </div>
        <div className="search-dialog-results">
          {!query.trim() && <p className="search-dialog-message">Find a project, note, or image by its title or text.</p>}
          {query.trim() && !loading && error && <p className="search-dialog-message is-error">{error}</p>}
          {query.trim() && !loading && !error && results.length === 0 && <p className="search-dialog-message">No results for “{query.trim()}”.</p>}
          {results.length > 0 && !loading && !error && (
            <>
              <p className="search-dialog-count" role="status">{total} result{total === 1 ? '' : 's'}{total > results.length ? ` · showing first ${results.length}` : ''}</p>
              {results.map((result) => (
                <button key={`${result.type}-${result.projectId}-${result.id}`} type="button" className="search-result" onClick={() => onSelect(result)}>
                  {result.type === 'image' && <span className="search-result-thumb"><img src={`/api/files/${encodeURIComponent(result.file)}`} alt="" loading="lazy" /></span>}
                  <span className="search-result-copy">
                    <span className="search-result-title">{result.title}</span>
                    {result.snippet && <span className="search-result-snippet">{result.snippet}</span>}
                    <span className="search-result-meta">{result.type === 'project' ? 'Project' : `${result.type === 'note' ? 'Note' : 'Image'} · ${result.projectTitle}`}</span>
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </dialog>
  )
}
