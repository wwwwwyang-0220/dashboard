import { useEffect, useRef, useState } from 'react'
import {
  noCompactor,
  Responsive,
  useContainerWidth,
} from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

import './App.css'
import { WarmTooltipGroup } from './components/WarmTooltip.jsx'
import ProjectCard from './ProjectCard.jsx'

const breakpoints = { desktop: 1100, tablet: 700, mobile: 0 }
const columns = { desktop: 12, tablet: 12, mobile: 4 }
const margins = {
  desktop: [28, 28],
  tablet: [24, 24],
  mobile: [16, 16],
}

const fallbackLayouts = {
  desktop: [
    { x: 7, y: 0, w: 5, h: 5 },
    { x: 0, y: 1, w: 6, h: 8 },
    { x: 7, y: 5, w: 5, h: 5 },
  ],
  tablet: [
    { x: 0, y: 8, w: 6, h: 6 },
    { x: 0, y: 0, w: 12, h: 8 },
    { x: 6, y: 8, w: 6, h: 6 },
  ],
  mobile: [
    { x: 0, y: 7, w: 4, h: 7 },
    { x: 0, y: 0, w: 4, h: 7 },
    { x: 0, y: 14, w: 4, h: 7 },
  ],
}

function getResponsiveLayouts(projects) {
  return Object.fromEntries(
    Object.entries(columns).map(([breakpoint, columnCount]) => [
      breakpoint,
      projects.map((project, index) => ({
        i: project.id,
        ...(project.layouts?.[breakpoint] ??
          (breakpoint === 'desktop' ? project.layout : null) ??
          fallbackLayouts[breakpoint][index]),
        minW: breakpoint === 'mobile' ? columnCount : 3,
        minH: 4,
        maxW: columnCount,
        maxH: 12,
      })),
    ]),
  )
}

function SaveIndicator({ state }) {
  const labels = {
    saved: 'Saved',
    saving: 'Saving',
    unsaved: 'Unsaved',
    failed: 'Not saved',
  }

  return (
    <span className="save-indicator" data-state={state} aria-live="polite">
      <span className="save-indicator-dot" aria-hidden="true" />
      <span>{labels[state]}</span>
    </span>
  )
}

function App() {
  const [projects, setProjects] = useState([])
  const [layouts, setLayouts] = useState({})
  const [activeBreakpoint, setActiveBreakpoint] = useState('desktop')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState('saved')
  const saveGeneration = useRef(0)
  const { width, containerRef, mounted } = useContainerWidth()

  useEffect(() => {
    let cancelled = false

    async function loadProjects() {
      try {
        const response = await fetch('/api/projects')

        if (!response.ok) {
          throw new Error('Could not load projects')
        }

        const loadedProjects = await response.json()

        if (!cancelled) {
          setProjects(loadedProjects)
          setLayouts(getResponsiveLayouts(loadedProjects))
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message)
          setSaveState('failed')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProjects()

    return () => {
      cancelled = true
    }
  }, [])

  async function saveProject(project) {
    const generation = ++saveGeneration.current
    setError('')
    setSaveState('saving')

    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: project.title,
          description: project.description,
          status: project.status,
        }),
      })
      const responseBody = await response.json()

      if (!response.ok) {
        throw new Error(responseBody.error ?? 'Could not save project')
      }

      setProjects((currentProjects) =>
        currentProjects.map((currentProject) =>
          currentProject.id === responseBody.id ? responseBody : currentProject,
        ),
      )

      if (generation === saveGeneration.current) {
        setSaveState('saved')
      }

      return responseBody
    } catch (saveError) {
      setError(saveError.message)
      if (generation === saveGeneration.current) {
        setSaveState('failed')
      }
      throw saveError
    }
  }

  async function saveLayout(updatedLayout) {
    const generation = ++saveGeneration.current
    const breakpoint = activeBreakpoint
    setError('')
    setSaveState('saving')

    try {
      const response = await fetch('/api/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          breakpoint,
          layout: updatedLayout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h })),
        }),
      })
      const responseBody = await response.json()

      if (!response.ok) {
        throw new Error(responseBody.error ?? 'Could not save layout')
      }

      if (generation === saveGeneration.current) {
        setProjects(responseBody)
        setLayouts(getResponsiveLayouts(responseBody))
        setSaveState('saved')
      }
    } catch (saveError) {
      setError(saveError.message)
      if (generation === saveGeneration.current) {
        setSaveState('failed')
      }
    }
  }

  function beginLayoutChange() {
    saveGeneration.current += 1
    setSaveState('saving')
  }

  return (
    <main className="dashboard">
      <header className="command-bar">
        <h1>Project Dashboard</h1>
        <SaveIndicator state={saveState} />
      </header>

      {error && <p className="message error-message" role="alert">{error}</p>}

      <section ref={containerRef} className="grid-container" aria-label="Projects">
        {loading ? (
          <p className="message loading-message">Loading projects…</p>
        ) : (
          mounted && (
            <WarmTooltipGroup delay={500} warmWindow={300} travel={220}>
              <Responsive
                width={width}
                layouts={layouts}
                breakpoints={breakpoints}
                cols={columns}
                rowHeight={28}
                margin={margins}
                containerPadding={[0, 0]}
                compactor={noCompactor}
                dragConfig={{ enabled: true, bounded: true, handle: '.card-drag-handle' }}
                resizeConfig={{ enabled: true, handles: ['se'] }}
                onBreakpointChange={setActiveBreakpoint}
                onLayoutChange={(_layout, nextLayouts) => setLayouts(nextLayouts)}
                onDragStart={beginLayoutChange}
                onResizeStart={beginLayoutChange}
                onDragStop={saveLayout}
                onResizeStop={saveLayout}
              >
                {projects.map((project) => (
                  <div key={project.id} className="grid-item">
                    <ProjectCard
                      project={project}
                      onSave={saveProject}
                      onDraftStateChange={setSaveState}
                    />
                  </div>
                ))}
              </Responsive>
            </WarmTooltipGroup>
          )
        )}
      </section>
    </main>
  )
}

export default App
