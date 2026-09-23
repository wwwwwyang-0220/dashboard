import { useEffect, useRef, useState } from 'react'
import { Ring } from 'loading-dev'

import Canvas from './Canvas.jsx'
import collapseIcon from './assets/sidebar/collapse.svg'
import collapseMenuIcon from './assets/sidebar/collapse-menu.svg'
import expandProjectIcon from './assets/sidebar/expand-project.svg'
import pageIcon from './assets/sidebar/page.svg'
import searchIcon from './assets/sidebar/search.svg'
import sidebarIcon from './assets/sidebar/sidebar.svg'
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

function Sidebar({ mode, menuOpen, onMenuToggle, onModeToggle, projects, selectedProject, search, onSearch, onSelectProject, onResizeStart, onResizeMove, onResizeEnd, onResizeKeyDown, sidebarWidth, sidebarRef, menuToggleRef, loading }) {
  const filteredProjects = projects.filter((project) => project.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <aside ref={sidebarRef} className={`sidebar sidebar--${mode}`} aria-label="Projects">
      {mode === 'pinned' && <div className="sidebar-toolbar">
        <span>Projects</span>
        <button type="button" className="sidebar-mode-button" aria-label="Use floating sidebar" onClick={onModeToggle}>
          <img src={collapseIcon} alt="" />
        </button>
      </div>}
      <button
        ref={menuToggleRef}
        type="button"
        className="sidebar-current"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? 'project-navigation' : undefined}
        onClick={onMenuToggle}
      >
        <span className="project-mark" aria-hidden="true"><span /><span /></span>
        <span className="sidebar-current-copy">
          <span className="sidebar-current-title">{selectedProject?.title ?? 'Projects'}</span>
          <span className="sidebar-current-caption">{selectedProject ? 'Current page' : 'Choose a project'}</span>
        </span>
        <img className="sidebar-current-chevron" src={menuOpen ? collapseMenuIcon : expandProjectIcon} alt="" />
      </button>
      {menuOpen && <div id="project-navigation" className="sidebar-menu">
        <div className="sidebar-section-heading">
          <span>Your projects</span>
          <span aria-label={`${projects.length} projects`}>{String(projects.length).padStart(2, '0')}</span>
        </div>
        <label className="sidebar-search">
          <img src={searchIcon} alt="" />
          <input type="search" placeholder="Search projects" value={search} onChange={(event) => onSearch(event.target.value)} aria-label="Search projects" />
        </label>
        <nav className="project-list" aria-label="Project pages">
          {filteredProjects.map((project) => (
            <button
              type="button"
              key={project.id}
              className={`project-link${selectedProject?.id === project.id ? ' is-current' : ''}`}
              aria-current={selectedProject?.id === project.id ? 'page' : undefined}
              onClick={() => onSelectProject(project.id)}
            >
              <img src={pageIcon} alt="" />
              <span className="project-link-copy">
                <span className="project-link-title">{project.title}</span>
                <span className="project-link-description">{selectedProject?.id === project.id ? 'Current page' : project.description}</span>
              </span>
            </button>
          ))}
          {!loading && projects.length > 0 && filteredProjects.length === 0 && <p className="search-empty">No matching projects</p>}
        </nav>
      </div>}
      {mode === 'pinned' && <>
        <div className="sidebar-footer">Switch projects without leaving the page</div>
        <div
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
        />
      </>}
    </aside>
  )
}

function App() {
  const [projects, setProjects] = useState([])
  const [selectedId, setSelectedId] = useState(new URLSearchParams(window.location.search).get('project'))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState('saved')
  const [sidebarMode, setSidebarMode] = useState(() => readPreference('dashboard.sidebarMode', readPreference('dashboard.sidebarOpen', true) ? 'pinned' : 'floating'))
  const [sidebarMenuOpen, setSidebarMenuOpen] = useState(sidebarMode === 'pinned')
  const [sidebarWidth, setSidebarWidth] = useState(() => readPreference('dashboard.sidebarWidth', 320))
  const [search, setSearch] = useState('')
  const saveQueue = useRef(Promise.resolve())
  const saveGeneration = useRef(0)
  const resizeStart = useRef(null)
  const sidebarRef = useRef(null)
  const menuToggleRef = useRef(null)

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

  useEffect(() => { localStorage.setItem('dashboard.sidebarMode', JSON.stringify(sidebarMode)) }, [sidebarMode])
  useEffect(() => { localStorage.setItem('dashboard.sidebarWidth', JSON.stringify(sidebarWidth)) }, [sidebarWidth])

  useEffect(() => {
    if (sidebarMode !== 'floating' || !sidebarMenuOpen) return
    function onPointerDown(event) {
      if (!sidebarRef.current?.contains(event.target)) setSidebarMenuOpen(false)
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setSidebarMenuOpen(false)
        menuToggleRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [sidebarMode, sidebarMenuOpen])

  function toggleSidebarMode() {
    setSidebarMode((mode) => mode === 'pinned' ? 'floating' : 'pinned')
    setSidebarMenuOpen(true)
  }

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

  function selectProject(id) {
    setSelectedId(id)
    const url = new URL(window.location.href)
    url.searchParams.set('project', id)
    window.history.pushState({}, '', url)
    if (sidebarMode === 'floating') setSidebarMenuOpen(false)
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
  return (
    <div className="app-shell" data-sidebar-mode={sidebarMode} style={{ '--sidebar-width': sidebarMode === 'pinned' ? `${sidebarWidth}px` : '0px' }}>
      <Sidebar
        mode={sidebarMode}
        menuOpen={sidebarMenuOpen}
        onMenuToggle={() => setSidebarMenuOpen((open) => !open)}
        onModeToggle={toggleSidebarMode}
        projects={projects}
        selectedProject={selectedProject}
        search={search}
        onSearch={setSearch}
        onSelectProject={selectProject}
        onResizeStart={startSidebarResize}
        onResizeMove={moveSidebarResize}
        onResizeEnd={endSidebarResize}
        onResizeKeyDown={resizeSidebarWithKeyboard}
        sidebarWidth={sidebarWidth}
        sidebarRef={sidebarRef}
        menuToggleRef={menuToggleRef}
        loading={loading}
      />
      <div className="main-column">
        <div className="topbar">
          {sidebarMode === 'floating' && <button type="button" className="sidebar-toggle" aria-label="Pin sidebar" onClick={toggleSidebarMode}><img src={sidebarIcon} alt="" /></button>}
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
