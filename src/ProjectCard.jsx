import { useRef, useState } from 'react'

import WarmTooltip from './components/WarmTooltip.jsx'

const statusLabels = {
  active: 'Active',
  planned: 'Planned',
  paused: 'Paused',
  completed: 'Completed',
}

function DragDots() {
  return (
    <span className="drag-dots" aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => <i key={index} />)}
    </span>
  )
}

function ProjectCard({ project, onSave, onDraftStateChange }) {
  const [draft, setDraft] = useState(project)
  const saveQueue = useRef(Promise.resolve())
  const saveGeneration = useRef(0)
  const skipNextCommit = useRef(false)

  function updateDraft(field, value) {
    saveGeneration.current += 1
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }))
    onDraftStateChange('unsaved')
  }

  function commitChanges() {
    if (skipNextCommit.current) {
      skipNextCommit.current = false
      return
    }

    const normalizedDraft = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim(),
    }

    if (!normalizedDraft.title || !normalizedDraft.description) {
      onDraftStateChange('failed')
      return
    }

    if (
      normalizedDraft.title === project.title &&
      normalizedDraft.description === project.description &&
      normalizedDraft.status === project.status
    ) {
      setDraft(normalizedDraft)
      onDraftStateChange('saved')
      return
    }

    setDraft(normalizedDraft)
    const generation = ++saveGeneration.current
    onDraftStateChange('saving')

    const operation = saveQueue.current.then(() => onSave(normalizedDraft))
    saveQueue.current = operation.catch(() => {})
    operation.then(
      () => {
        if (generation === saveGeneration.current) {
          onDraftStateChange('saved')
        }
      },
      () => {
        if (generation === saveGeneration.current) {
          onDraftStateChange('failed')
        }
      },
    )
  }

  function handleTitleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      event.currentTarget.blur()
    }

    if (event.key === 'Escape') {
      skipNextCommit.current = true
      setDraft((currentDraft) => ({ ...currentDraft, title: project.title }))
      onDraftStateChange('saved')
      event.currentTarget.blur()
    }
  }

  return (
    <article className="project-surface" data-status={draft.status}>
      <WarmTooltip
        content="Drag to move"
        side="top"
        longPress={600}
        surfaceColor="rgba(22, 28, 40, 0.9)"
        inkColor="#ffffff"
      >
        <button
          type="button"
          className="card-drag-handle"
          aria-label={`Move ${draft.title}`}
        >
          <DragDots />
        </button>
      </WarmTooltip>

      <label className="status-control" data-status={draft.status}>
        <span className="status-dot" aria-hidden="true" />
        <select
          value={draft.status}
          aria-label={`Status for ${draft.title}`}
          onChange={(event) => updateDraft('status', event.target.value)}
          onBlur={commitChanges}
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <div className="project-content">
        <input
          className="inline-title"
          value={draft.title}
          maxLength="120"
          aria-label="Project title"
          onChange={(event) => updateDraft('title', event.target.value)}
          onBlur={commitChanges}
          onKeyDown={handleTitleKeyDown}
        />

        <textarea
          className="inline-description"
          value={draft.description}
          maxLength="1000"
          aria-label="Project description"
          onChange={(event) => updateDraft('description', event.target.value)}
          onBlur={commitChanges}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.currentTarget.blur()
            }
          }}
        />
      </div>
    </article>
  )
}

export default ProjectCard
