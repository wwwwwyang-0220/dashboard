import { useRef, useState } from 'react'

const GRID = 24
const INITIAL_PAN = { x: 80, y: 94 }
const BLOCK_TYPES = [
  ['text', 'Text note'],
  ['checklist', 'Checklist'],
  ['references', 'References'],
]

function blockTemplate(type, x, y) {
  const base = {
    id: crypto.randomUUID(),
    type,
    x,
    y,
    w: type === 'references' ? 22 : 18,
    h: type === 'checklist' ? 12 : 10,
    title: type === 'text' ? 'Untitled note' : type === 'checklist' ? 'Next steps' : 'References',
  }
  return type === 'text' ? { ...base, content: '' } : { ...base, items: [] }
}

export default function Canvas({ project, onSave, onDraftStateChange }) {
  const [blocks, setBlocksState] = useState(project.blocks ?? [])
  const blocksRef = useRef(project.blocks ?? [])
  const [pan, setPan] = useState(INITIAL_PAN)
  const panRef = useRef(pan)
  const [zoom, setZoom] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [menuBlockId, setMenuBlockId] = useState(null)
  const [interaction, setInteraction] = useState(null)
  const viewportRef = useRef(null)

  function setBlocks(next) {
    blocksRef.current = next
    setBlocksState(next)
    onDraftStateChange('unsaved')
  }

  function commit(next = blocksRef.current) {
    onSave(project.id, next)
  }

  function updateBlock(id, changes, save = false) {
    const next = blocksRef.current.map((block) => block.id === id ? { ...block, ...changes } : block)
    setBlocks(next)
    if (save) commit(next)
  }

  function setPanPosition(next) {
    panRef.current = next
    setPan(next)
  }

  function addBlock(type) {
    const viewport = viewportRef.current
    const centerX = ((viewport?.clientWidth ?? 1000) / 2 - panRef.current.x) / zoom
    const centerY = ((viewport?.clientHeight ?? 700) / 2 - panRef.current.y) / zoom
    const block = blockTemplate(type, Math.round(centerX / GRID) - 9, Math.round(centerY / GRID) - 5)
    const next = [...blocksRef.current, block]
    setBlocks(next)
    commit(next)
    setAddOpen(false)
  }

  function removeBlock(id) {
    const next = blocksRef.current.filter((block) => block.id !== id)
    setBlocks(next)
    commit(next)
    setMenuBlockId(null)
  }

  function startInteraction(event, kind, block) {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setInteraction({
      kind,
      id: block?.id,
      pointerX: event.clientX,
      pointerY: event.clientY,
      initialPan: panRef.current,
      initialBlock: block,
    })
  }

  function onPointerMove(event) {
    if (!interaction) return
    const deltaX = event.clientX - interaction.pointerX
    const deltaY = event.clientY - interaction.pointerY
    if (interaction.kind === 'pan') {
      setPanPosition({ x: interaction.initialPan.x + deltaX, y: interaction.initialPan.y + deltaY })
      return
    }
    const unitX = Math.round(deltaX / (GRID * zoom))
    const unitY = Math.round(deltaY / (GRID * zoom))
    if (interaction.kind === 'move') {
      updateBlock(interaction.id, { x: interaction.initialBlock.x + unitX, y: interaction.initialBlock.y + unitY })
    } else {
      updateBlock(interaction.id, {
        w: Math.max(8, Math.min(40, interaction.initialBlock.w + unitX)),
        h: Math.max(6, Math.min(40, interaction.initialBlock.h + unitY)),
      })
    }
  }

  function endInteraction() {
    if (interaction && interaction.kind !== 'pan') commit()
    setInteraction(null)
  }

  function onWheel(event) {
    if (event.target.closest('input, textarea, select')) return
    setPanPosition({
      x: panRef.current.x - (event.shiftKey ? event.deltaY : event.deltaX),
      y: panRef.current.y - (event.shiftKey ? 0 : event.deltaY),
    })
  }

  function onKeyDown(event) {
    if (event.target !== viewportRef.current) return
    const movement = {
      ArrowLeft: [48, 0], ArrowRight: [-48, 0], ArrowUp: [0, 48], ArrowDown: [0, -48],
    }[event.key]
    if (movement) {
      event.preventDefault()
      setPanPosition({ x: panRef.current.x + movement[0], y: panRef.current.y + movement[1] })
    }
  }

  return (
    <section className="canvas-shell" aria-label={`${project.title} canvas`}>
      <div className="canvas-actions">
        <button type="button" className="add-block-button" onClick={() => setAddOpen(!addOpen)} aria-expanded={addOpen}>
          <span aria-hidden="true">＋</span> Add block
        </button>
        {addOpen && (
          <div className="add-menu" role="menu" aria-label="Block type">
            {BLOCK_TYPES.map(([type, label]) => (
              <button key={type} type="button" role="menuitem" onClick={() => addBlock(type)}>{label}</button>
            ))}
          </div>
        )}
      </div>
      <div
        ref={viewportRef}
        className={`canvas-viewport${interaction?.kind === 'pan' ? ' is-panning' : ''}`}
        tabIndex={0}
        aria-label="Canvas. Drag empty space or use arrow keys to move around."
        style={{ '--grid-step': `${GRID * zoom * 5}px`, '--grid-x': `${pan.x}px`, '--grid-y': `${pan.y}px` }}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) startInteraction(event, 'pan')
        }}
        onPointerMove={onPointerMove}
        onPointerUp={endInteraction}
        onPointerCancel={endInteraction}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <div className="canvas-plane" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
          {blocks.map((block) => (
            <article
              key={block.id}
              className="canvas-block"
              style={{ left: block.x * GRID, top: block.y * GRID, width: block.w * GRID, height: block.h * GRID }}
            >
              <div className="block-topline">
                <span>{block.type === 'text' ? 'Text' : block.type === 'checklist' ? 'Checklist' : 'References'}</span>
                <div className="block-controls">
                  <button
                    type="button"
                    className="block-move"
                    aria-label={`Move ${block.title}`}
                    title="Drag to move"
                    onPointerDown={(event) => startInteraction(event, 'move', block)}
                  >⠿</button>
                  <button type="button" className="block-menu-toggle" aria-label={`Options for ${block.title}`} aria-expanded={menuBlockId === block.id} onClick={() => setMenuBlockId(menuBlockId === block.id ? null : block.id)}>⋯</button>
                  {menuBlockId === block.id && (
                    <div className="block-menu">
                      <button type="button" onClick={() => removeBlock(block.id)}>Delete block</button>
                    </div>
                  )}
                </div>
              </div>
              <input
                className="block-title"
                aria-label="Block title"
                value={block.title}
                maxLength={120}
                onChange={(event) => updateBlock(block.id, { title: event.target.value })}
                onBlur={() => commit()}
              />
              {block.type === 'text' ? (
                <textarea
                  className="block-text"
                  aria-label={`${block.title} content`}
                  placeholder="Write something…"
                  value={block.content}
                  onChange={(event) => updateBlock(block.id, { content: event.target.value })}
                  onBlur={() => commit()}
                />
              ) : (
                <div className="block-items">
                  {block.items.map((item, index) => (
                    <div className="block-item" key={`${block.id}-${index}`}>
                      {block.type === 'checklist' ? (
                        <input
                          type="checkbox"
                          checked={item.done}
                          aria-label={`Complete ${item.text || `item ${index + 1}`}`}
                          onChange={(event) => updateBlock(block.id, {
                            items: block.items.map((current, itemIndex) => itemIndex === index ? { ...current, done: event.target.checked } : current),
                          }, true)}
                        />
                      ) : <span className="reference-index">{index + 1}.</span>}
                      <input
                        type="text"
                        value={item.text}
                        aria-label={`${block.type === 'checklist' ? 'Checklist' : 'Reference'} item ${index + 1}`}
                        onChange={(event) => updateBlock(block.id, {
                          items: block.items.map((current, itemIndex) => itemIndex === index ? { ...current, text: event.target.value } : current),
                        })}
                        onBlur={() => commit()}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    className="add-item"
                    onClick={() => updateBlock(block.id, {
                      items: [...block.items, block.type === 'checklist' ? { text: '', done: false } : { text: '' }],
                    }, true)}
                  >+ Add item</button>
                </div>
              )}
              <button
                type="button"
                className="block-resize"
                aria-label={`Resize ${block.title}`}
                title="Drag to resize"
                onPointerDown={(event) => startInteraction(event, 'resize', block)}
              />
            </article>
          ))}
        </div>
      </div>
      {blocks.length === 0 && (
        <p className="canvas-empty">This project’s canvas is empty. Add a block to start.</p>
      )}
      <div className="canvas-navigation" aria-label="Canvas navigation">
        <button type="button" onClick={() => setZoom(Math.max(0.5, Math.round((zoom - 0.1) * 10) / 10))} aria-label="Zoom out">−</button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom(Math.min(1.5, Math.round((zoom + 0.1) * 10) / 10))} aria-label="Zoom in">+</button>
        <span className="control-divider" />
        <button type="button" onClick={() => setPanPosition(INITIAL_PAN)}>Origin</button>
      </div>
    </section>
  )
}
