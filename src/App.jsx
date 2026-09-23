import { useEffect, useRef, useState } from 'react'
import { Page, Search, SidebarCollapse, SidebarExpand } from 'iconoir-react'
import { Ring } from 'loading-dev'

import Canvas from './Canvas.jsx'
import './App.css'

function readPreference(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch {
    return fallback
  }
}

function SaveIndicator({ state }) {
  const label = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved', failed: 'Not saved' }[state]
  return <span className="save-indicator" data-state={state} aria-live="polite">
    {state === 'saving' && <Ring size={14} duration={1400} />}
    {label}
  </span>
}

function ProjectHeader({ project, onSave, onDraftStateChange }) {
  const [draft, setDraft] = useState({ title: project.title, description: project.description })

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
    onDraftStateChange('unsaved')
  }

  function commit(next = draft) {
    const normalized = { ...next, title: next.title.trim(), description: next.description.trim() }
    if (!normalized.title || !normalized.description) {
      onDraftStateChange('failed')
      return
    }
    if (normalized.title === project.title && normalized.description === project.description) {
      onDraftStateChange('saved')
      return
    }
    setDraft(normalized)
    onSave(project.id, normalized)
  }

  return (
    <header className="project-header">
      <input
        className="page-title"
        value={draft.title}
        maxLength={120}
        aria-label="Project title"
        onChange={(event) => update('title', event.target.value)}
        onBlur={() => commit()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
      />
      <div className="project-meta">
        <textarea
          className="project-description"
          value={draft.description}
          maxLength={1000}
          rows={1}
          aria-label="Project description"
          onChange={(event) => update('description', event.target.value)}
          onBlur={() => commit()}
        />
      </div>
    </header>
  )
}

function App() {
  const [projects, setProjects] = useState([])
  const [selectedId, setSelectedId] = useState(new URLSearchParams(window.location.search).get('project'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState('saved')
  const [sidebarOpen, setSidebarOpen] = useState(() => readPreference('dashboard.sidebarOpen', true))
  const [sidebarWidth, setSidebarWidth] = useState(() => readPreference('dashboard.sidebarWidth', 308))
  const [search, setSearch] = useState('')
  const saveQueue = useRef(Promise.resolve())
  const saveGeneration = useRef(0)
  const resizeStart = useRef(null)

  function markDraft(state) {
    if (state === 'unsaved' || state === 'failed') saveGeneration.current += 1
    setSaveState(state)
  }

  useEffect(() => {
    let cancelled = false
    fetch('/api/projects').then(async (response) => {
      if (!response.ok) throw new Error('Could not load projects')
      return response.json()
    }).then((loaded) => {
      if (cancelled) return
      setProjects(loaded)
      setSelectedId((current) => loaded.some((project) => project.id === current) ? current : loaded[0]?.id ?? null)
    }).catch((loadError) => {
      if (!cancelled) setError(loadError.message)
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    function onPopState() {
      setSelectedId(new URLSearchParams(window.location.search).get('project'))
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => { localStorage.setItem('dashboard.sidebarOpen', JSON.stringify(sidebarOpen)) }, [sidebarOpen])
  useEffect(() => { localStorage.setItem('dashboard.sidebarWidth', JSON.stringify(sidebarWidth)) }, [sidebarWidth])

  function selectProject(id) {
    setSelectedId(id)
    const url = new URL(window.location.href)
    url.searchParams.set('project', id)
    window.history.pushState({}, '', url)
  }

  function enqueueSave(request) {
    const generation = ++saveGeneration.current
    setError('')
    setSaveState('saving')
    const operation = saveQueue.current.then(request)
    saveQueue.current = operation.catch(() => {})
    operation.then(() => {
      if (generation === saveGeneration.current) setSaveState('saved')
    }, (saveError) => {
      setError(saveError.message)
      if (generation === saveGeneration.current) setSaveState('failed')
    })
  }

  function saveMetadata(id, values) {
    setProjects((current) => current.map((project) => project.id === id ? { ...project, ...values } : project))
    enqueueSave(async () => {
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error((await response.json()).error ?? 'Could not save project')
    })
  }

  function saveBlocks(id, blocks) {
    setProjects((current) => current.map((project) => project.id === id ? { ...project, blocks } : project))
    enqueueSave(async () => {
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}/blocks`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocks }),
      })
      if (!response.ok) throw new Error((await response.json()).error ?? 'Could not save canvas')
    })
  }

  const selectedProject = projects.find((project) => project.id === selectedId) ?? projects[0]
  const filteredProjects = projects.filter((project) => project.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="app-shell" style={{ '--sidebar-width': sidebarOpen ? `${sidebarWidth}px` : '0px' }}>
      {sidebarOpen && (
        <aside className="sidebar" aria-label="Projects">
          <label className="sidebar-search">
            <Search className="ui-icon" aria-hidden="true" />
            <input type="search" placeholder="Search projects" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search projects" />
          </label>
          <div className="sidebar-section-label">Projects</div>
          <nav className="project-list" aria-label="Project pages">
            {filteredProjects.map((project) => (
              <button
                type="button"
                key={project.id}
                className={`project-link${selectedProject?.id === project.id ? ' is-current' : ''}`}
                aria-current={selectedProject?.id === project.id ? 'page' : undefined}
                onClick={() => selectProject(project.id)}
              >
                <Page className="ui-icon page-icon" aria-hidden="true" />
                <span>{project.title}</span>
              </button>
            ))}
            {!loading && projects.length > 0 && filteredProjects.length === 0 && <p className="search-empty">No matching projects</p>}
          </nav>
          <div
            className="sidebar-resizer"
            role="separator"
            aria-label="Resize sidebar"
            aria-orientation="vertical"
            aria-valuemin={220}
            aria-valuemax={400}
            aria-valuenow={sidebarWidth}
            tabIndex={0}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              resizeStart.current = { x: event.clientX, width: sidebarWidth }
            }}
            onPointerMove={(event) => {
              if (resizeStart.current) setSidebarWidth(Math.max(220, Math.min(400, resizeStart.current.width + event.clientX - resizeStart.current.x)))
            }}
            onPointerUp={() => { resizeStart.current = null }}
            onPointerCancel={() => { resizeStart.current = null }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault()
                setSidebarWidth((width) => Math.max(220, Math.min(400, width + (event.key === 'ArrowLeft' ? -16 : 16))))
              }
            }}
          />
        </aside>
      )}
      <div className="main-column">
        <div className="topbar">
          <button type="button" className="sidebar-toggle" aria-label={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'} aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <SidebarCollapse className="ui-icon sidebar-icon" aria-hidden="true" /> : <SidebarExpand className="ui-icon sidebar-icon" aria-hidden="true" />}
          </button>
          {!loading && selectedProject && <SaveIndicator state={saveState} />}
        </div>
        {error && <div className="app-error" role="alert">{error}</div>}
        {loading ? <p className="loading-message" role="status"><Ring size={18} duration={1400} /> Loading projects…</p> : selectedProject ? (
          <>
            <ProjectHeader key={`header-${selectedProject.id}`} project={selectedProject} onSave={saveMetadata} onDraftStateChange={markDraft} />
            <Canvas key={`canvas-${selectedProject.id}`} project={selectedProject} onSave={saveBlocks} onDraftStateChange={markDraft} />
          </>
        ) : !error ? <p className="loading-message">No projects yet.</p> : null}
      </div>
    </div>
  )
}

export default App
