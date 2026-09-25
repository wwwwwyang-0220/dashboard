import { useEffect, useRef, useState } from 'react'
import { Computer, HalfMoon, SunLight } from 'iconoir-react'
import { Ring } from 'loading-dev'

import BoardView from './BoardView.jsx'
import ProjectHome from './ProjectHome.jsx'
import pageIcon from './assets/sidebar/page.svg'
import searchIcon from './assets/sidebar/search.svg'
import sidebarCollapseIcon from './assets/sidebar/sidebar-collapse.svg'
import sidebarExpandIcon from './assets/sidebar/sidebar-expand.svg'
import './App.css'

function readPreference(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch {
    return fallback
  }
}

const THEMES = [['system', 'System', Computer], ['light', 'Light', SunLight], ['dark', 'Dark', HalfMoon]]

// Draws a single-colour SVG in the current text colour, so it follows the theme.
function MaskIcon({ src, size = 18 }) {
  return <span className="mask-icon" style={{ '--icon': `url("${src}")`, width: size, height: size }} aria-hidden="true" />
}

function ThemeSwitch({ theme, onChange }) {
  return (
    <div className="theme-switch" role="radiogroup" aria-label="Appearance">
      {THEMES.map(([value, label, Icon]) => (
        <button key={value} type="button" role="radio" aria-checked={theme === value} title={label} aria-label={label} onClick={() => onChange(value)}>
          <Icon className="ui-icon" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
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

function Sidebar({ open, projects, selectedProject, search, onSearch, onSelectProject, onResizeStart, onResizeMove, onResizeEnd, onResizeKeyDown, sidebarWidth, loading, theme, onTheme }) {
  const filteredProjects = projects.filter((project) => project.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <aside id="project-navigation" className="sidebar" aria-label="Projects" inert={!open}>
      <div className="sidebar-content">
        <label className="sidebar-search">
          <MaskIcon src={searchIcon} />
          <input type="search" placeholder="Search projects" value={search} onChange={(event) => onSearch(event.target.value)} aria-label="Search projects" />
        </label>
        <p className="sidebar-section-heading">Projects</p>
        <nav className="project-list" aria-label="Project pages">
          {filteredProjects.map((project) => (
            <button
              type="button"
              key={project.id}
              className={`project-link${selectedProject?.id === project.id ? ' is-current' : ''}`}
              aria-current={selectedProject?.id === project.id ? 'page' : undefined}
              onClick={() => onSelectProject(project.id)}
            >
              <MaskIcon src={pageIcon} />
              <span className="project-link-title">{project.title}</span>
            </button>
          ))}
          {!loading && projects.length > 0 && filteredProjects.length === 0 && <p className="search-empty">No matching projects</p>}
        </nav>
      </div>
      <div className="sidebar-footer">
        <ThemeSwitch theme={theme} onChange={onTheme} />
      </div>
      {open && <div
        className="sidebar-resizer"
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuemin={220}
        aria-valuemax={400}
        aria-valuenow={sidebarWidth}
        tabIndex={0}
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeEnd}
        onPointerCancel={onResizeEnd}
        onKeyDown={onResizeKeyDown}
      />}
    </aside>
  )
}

function App() {
  const [projects, setProjects] = useState([])
  const projectsRef = useRef([])
  const [selectedId, setSelectedId] = useState(() => new URLSearchParams(window.location.search).get('project'))
  const [boardId, setBoardId] = useState(() => new URLSearchParams(window.location.search).get('board'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState('saved')
  const [sidebarOpen, setSidebarOpen] = useState(() => readPreference('dashboard.sidebarVisible', readPreference('dashboard.sidebarMode', readPreference('dashboard.sidebarOpen', true) ? 'pinned' : 'floating') === 'pinned'))
  const [sidebarWidth, setSidebarWidth] = useState(() => readPreference('dashboard.sidebarWidth', 242))
  const [search, setSearch] = useState('')
  // Opening a board collapses the sidebar for focus without changing the saved
  // preference. Reopening it by hand keeps it open for the rest of that visit.
  const [dismissedFocusBoardId, setDismissedFocusBoardId] = useState(null)
  const [theme, setTheme] = useState(() => readPreference('dashboard.theme', 'system'))
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
      replaceProjects(loaded)
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
      const params = new URLSearchParams(window.location.search)
      setSelectedId(params.get('project'))
      setBoardId(params.get('board'))
      setDismissedFocusBoardId(null)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => { localStorage.setItem('dashboard.sidebarVisible', JSON.stringify(sidebarOpen)) }, [sidebarOpen])
  useEffect(() => { localStorage.setItem('dashboard.sidebarWidth', JSON.stringify(sidebarWidth)) }, [sidebarWidth])
  useEffect(() => {
    if (theme === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('dashboard.theme', JSON.stringify(theme))
    } catch {
      // The appearance still applies for this visit.
    }
  }, [theme])

  function startSidebarResize(event) {
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeStart.current = { x: event.clientX, width: sidebarWidth }
  }

  function moveSidebarResize(event) {
    if (resizeStart.current) setSidebarWidth(Math.max(220, Math.min(400, resizeStart.current.width + event.clientX - resizeStart.current.x)))
  }

  function endSidebarResize() { resizeStart.current = null }

  function resizeSidebarWithKeyboard(event) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      setSidebarWidth((width) => Math.max(220, Math.min(400, width + (event.key === 'ArrowLeft' ? -16 : 16))))
    }
  }

  function replaceProjects(next) {
    projectsRef.current = next
    setProjects(next)
  }

  function navigate(projectId, nextBoardId) {
    setSelectedId(projectId)
    setBoardId(nextBoardId)
    setDismissedFocusBoardId(null)
    const url = new URL(window.location.href)
    url.searchParams.set('project', projectId)
    if (nextBoardId) url.searchParams.set('board', nextBoardId)
    else url.searchParams.delete('board')
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
    replaceProjects(projectsRef.current.map((project) => project.id === id ? { ...project, ...values } : project))
    enqueueSave(async () => {
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values),
      })
      if (!response.ok) throw new Error((await response.json()).error ?? 'Could not save project')
    })
  }

  // Applies local changes to a project's to-dos, items, or boards. `changes` may be a
  // function of the latest project. Fields named in `persist` are saved now; other
  // edits stay local until a later persist call.
  function changeProject(id, changes, persist = []) {
    replaceProjects(projectsRef.current.map((project) => project.id === id
      ? { ...project, ...(typeof changes === 'function' ? changes(project) : changes) }
      : project))
    if (persist.length === 0) markDraft('unsaved')
    for (const field of persist) persistField(id, field)
  }

  function persistField(id, field) {
    const value = projectsRef.current.find((project) => project.id === id)?.[field]
    if (value === undefined) return
    enqueueSave(async () => {
      const response = await fetch(`/api/projects/${encodeURIComponent(id)}/${field}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }),
      })
      if (!response.ok) throw new Error((await response.json()).error ?? `Could not save ${field}`)
    })
  }

  async function uploadImage(id, file) {
    const response = await fetch(`/api/projects/${encodeURIComponent(id)}/images`, {
      method: 'POST', headers: { 'Content-Type': file.type }, body: file,
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error ?? 'Could not upload image')
    return body.file
  }

  const selectedProject = projects.find((project) => project.id === selectedId) ?? projects[0]
  const selectedBoard = selectedProject?.boards.find((board) => board.id === boardId)
  const boardFocus = Boolean(selectedBoard) && dismissedFocusBoardId !== selectedBoard.id
  const sidebarShown = sidebarOpen && !boardFocus

  function toggleSidebar() {
    if (boardFocus) {
      setDismissedFocusBoardId(selectedBoard.id)
      setSidebarOpen(true)
    } else {
      setSidebarOpen((open) => !open)
    }
  }

  const projectActions = selectedProject && {
    onChange: (changes, persist) => changeProject(selectedProject.id, changes, persist),
    onPersist: (field) => persistField(selectedProject.id, field),
  }
  return (
    <div className="app-shell" data-sidebar-open={sidebarShown} style={{ '--sidebar-width': sidebarShown ? `${sidebarWidth}px` : '0px' }}>
      <Sidebar
        open={sidebarShown}
        projects={projects}
        selectedProject={selectedProject}
        search={search}
        onSearch={setSearch}
        onSelectProject={(id) => navigate(id, null)}
        onResizeStart={startSidebarResize}
        onResizeMove={moveSidebarResize}
        onResizeEnd={endSidebarResize}
        onResizeKeyDown={resizeSidebarWithKeyboard}
        sidebarWidth={sidebarWidth}
        loading={loading}
        theme={theme}
        onTheme={setTheme}
      />
      <div className="topbar">
        <button type="button" className="sidebar-toggle" aria-label={sidebarShown ? 'Collapse sidebar' : 'Expand sidebar'} title={sidebarShown ? 'Collapse sidebar' : 'Expand sidebar'} aria-controls="project-navigation" aria-expanded={sidebarShown} onClick={toggleSidebar}><MaskIcon src={sidebarShown ? sidebarCollapseIcon : sidebarExpandIcon} size={20} /></button>
        {!loading && selectedProject && <SaveIndicator state={saveState} />}
      </div>
      <div className="main-column">
        {error && <div className="app-error" role="alert">{error}</div>}
        {loading ? <p className="loading-message" role="status"><Ring size={18} duration={1400} /> Loading projects…</p> : selectedProject ? (
          <>
            {selectedBoard ? (
              <BoardView
                key={`board-${selectedProject.id}-${selectedBoard.id}`}
                project={selectedProject}
                board={selectedBoard}
                onBack={() => navigate(selectedProject.id, null)}
                {...projectActions}
              />
            ) : (
              <>
                <ProjectHeader key={`header-${selectedProject.id}`} project={selectedProject} onSave={saveMetadata} onDraftStateChange={markDraft} />
                <ProjectHome
                  key={`home-${selectedProject.id}`}
                  project={selectedProject}
                  onOpenBoard={(id) => navigate(selectedProject.id, id)}
                  onUploadImage={(file) => uploadImage(selectedProject.id, file)}
                  onError={setError}
                  {...projectActions}
                />
              </>
            )}
          </>
        ) : !error ? <p className="loading-message">No projects yet.</p> : null}
      </div>
    </div>
  )
}

export default App
