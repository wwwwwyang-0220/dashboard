import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, DotsGrid3x3, MoreHoriz, NavArrowLeft, Plus, Search, Xmark } from 'iconoir-react'

import {
  alignment, bottomRow, COLUMNS, defaultSize, fits, GAP, MAX_H, MIN_H, MIN_W, nearestFreeSlot, nextFreeSlot, ROW,
} from './board-layout.js'
import { imageUrl, itemTitle, newNote } from './items.js'
import './Workspace.css'

const DRAG_TYPE = 'application/x-dashboard-item'
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const sameRect = (a, b) => a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h

function Menu({ label, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function close(event) {
      if (!ref.current?.contains(event.target)) setOpen(false)
    }
    function escape(event) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', escape)
    }
  }, [open])

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="icon-button" aria-label={label} title={label} aria-expanded={open} onClick={() => setOpen(!open)}>
        <MoreHoriz className="ui-icon" aria-hidden="true" />
      </button>
      {open && <div className="menu-popover" onClick={() => setOpen(false)}>{children}</div>}
    </div>
  )
}

function LibraryDrawer({ items, onBoard, onAdd, onNewNote, onDragItem, onClose }) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const matches = [...items].reverse().filter((item) => !needle
    || item.title.toLowerCase().includes(needle)
    || (item.type === 'note' && item.content.toLowerCase().includes(needle)))
  const groups = [['image', 'Images'], ['note', 'Notes']].map(([type, label]) => [label, matches.filter((item) => item.type === type)])

  return (
    <aside className="library-drawer" aria-label="Add from library">
      <div className="drawer-header">
        <h2>Add from library</h2>
        <button type="button" className="icon-button" aria-label="Close library" title="Close" onClick={onClose}><Xmark className="ui-icon" aria-hidden="true" /></button>
      </div>
      <label className="drawer-search">
        <Search className="ui-icon" aria-hidden="true" />
        <input type="search" value={query} placeholder="Search notes and images" aria-label="Search library" onChange={(event) => setQuery(event.target.value)} />
      </label>
      <p className="drawer-hint">Drag onto the board, or press + to add at the next free space.</p>
      <div className="drawer-list">
        {groups.map(([label, group]) => group.length > 0 && (
          <div key={label} role="group" aria-label={label}>
            <p className="drawer-group">{label} · {group.length}</p>
            {group.map((item) => {
              const placed = onBoard.has(item.id)
              return (
                <div
                  key={item.id}
                  className={`drawer-item${placed ? ' is-placed' : ''}`}
                  draggable={!placed}
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_TYPE, item.id)
                    event.dataTransfer.effectAllowed = 'copy'
                    onDragItem(item)
                  }}
                  onDragEnd={() => onDragItem(null)}
                >
                  <span className={`drawer-thumb is-${item.type}`}>
                    {item.type === 'image' ? <img src={imageUrl(item)} alt="" loading="lazy" /> : <span />}
                  </span>
                  <span className="drawer-item-text">
                    <span className="drawer-item-title">{itemTitle(item)}</span>
                    <span className="drawer-item-meta">{item.type === 'image' ? 'Image' : item.content.split('\n')[0].slice(0, 40) || 'Empty note'}</span>
                  </span>
                  {placed
                    ? <span className="drawer-placed"><Check className="ui-icon" aria-hidden="true" /> On board</span>
                    : <button type="button" className="icon-button" aria-label={`Add ${itemTitle(item)} to board`} title="Add to board" onClick={() => onAdd(item)}><Plus className="ui-icon" aria-hidden="true" /></button>}
                </div>
              )
            })}
          </div>
        ))}
        {matches.length === 0 && <p className="section-empty">{items.length === 0 ? 'The library is empty.' : 'No matches.'}</p>}
        <button type="button" className="drawer-new-note" onClick={onNewNote}><Plus className="ui-icon" aria-hidden="true" /> New note on this board</button>
      </div>
    </aside>
  )
}

function CardBody({ item, onEditNote, onCommitNote }) {
  if (item.type === 'image') {
    return <img className="board-card-image" src={imageUrl(item)} alt={itemTitle(item)} draggable={false} />
  }
  return (
    <textarea
      className="board-card-text"
      value={item.content}
      maxLength={20000}
      placeholder="Write something…"
      aria-label={`${itemTitle(item)} note`}
      onChange={(event) => onEditNote(event.target.value)}
      onBlur={onCommitNote}
    />
  )
}

export default function BoardView({ project, board, onBack, onChange, onPersist }) {
  const [name, setName] = useState(board.name)
  const [drawerOpen, setDrawerOpen] = useState(board.cards.length === 0)
  const [width, setWidth] = useState(0)
  const [interaction, setInteraction] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const gridRef = useRef(null)
  const draggedItem = useRef(null)

  const itemsById = new Map(project.items.map((item) => [item.id, item]))
  const cards = board.cards.filter((card) => itemsById.has(card.itemId))
  const onBoard = new Set(cards.map((card) => card.itemId))
  const columnWidth = width / COLUMNS

  useLayoutEffect(() => {
    const grid = gridRef.current
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(grid)
    return () => observer.disconnect()
  }, [])

  function saveCards(nextCards) {
    onChange((current) => ({
      boards: current.boards.map((candidate) => candidate.id === board.id
        ? { ...candidate, cards: nextCards, updatedAt: new Date().toISOString() }
        : candidate),
    }), ['boards'])
  }

  function placeCard(item, rect) {
    saveCards([...cards, { itemId: item.id, ...rect }])
  }

  function addItem(item) {
    placeCard(item, nextFreeSlot(cards, defaultSize(item, columnWidth)))
  }

  function addNewNote() {
    const note = newNote()
    const rect = nextFreeSlot(cards, defaultSize(note, columnWidth))
    onChange((current) => ({
      items: [...current.items, note],
      boards: current.boards.map((candidate) => candidate.id === board.id
        ? { ...candidate, cards: [...cards, { itemId: note.id, ...rect }], updatedAt: new Date().toISOString() }
        : candidate),
    }), ['items', 'boards'])
    requestAnimationFrame(() => document.querySelector(`[data-item-id="${note.id}"] textarea`)?.focus())
  }

  function editNote(id, content) {
    onChange((current) => ({
      items: current.items.map((item) => item.id === id ? { ...item, content, updatedAt: new Date().toISOString() } : item),
    }))
  }

  function commitName() {
    const trimmed = name.trim()
    if (!trimmed) {
      setName(board.name)
      return
    }
    if (trimmed === board.name) return
    setName(trimmed)
    onChange((current) => ({
      boards: current.boards.map((candidate) => candidate.id === board.id ? { ...candidate, name: trimmed, updatedAt: new Date().toISOString() } : candidate),
    }), ['boards'])
  }

  function deleteBoard() {
    if (!window.confirm(`Delete the board “${board.name}”? Its notes and images stay in the library.`)) return
    onBack()
    onChange((current) => ({ boards: current.boards.filter((candidate) => candidate.id !== board.id) }), ['boards'])
  }

  // Pointer arrangement: the card follows the pointer while a snapped preview shows where it lands.
  function startInteraction(event, kind, card) {
    if (event.button !== 0 || !columnWidth) return
    if (kind === 'move' && event.target.closest('button:not(.card-move), input, textarea')) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setInteraction({ kind, itemId: card.itemId, startX: event.clientX, startY: event.clientY, origin: card, target: card, dx: 0, dy: 0 })
  }

  function moveInteraction(event) {
    if (!interaction) return
    const dx = event.clientX - interaction.startX
    const dy = event.clientY - interaction.startY
    const { origin } = interaction
    const candidate = interaction.kind === 'move'
      ? { ...origin, x: clamp(Math.round(origin.x + dx / columnWidth), 0, COLUMNS - origin.w), y: Math.max(0, Math.round(origin.y + dy / ROW)) }
      : { ...origin, w: clamp(Math.round(origin.w + dx / columnWidth), MIN_W, COLUMNS - origin.x), h: clamp(Math.round(origin.h + dy / ROW), MIN_H, MAX_H) }
    const target = fits(candidate, cards, origin.itemId) ? candidate : interaction.target
    setInteraction({ ...interaction, dx, dy, target })
  }

  function endInteraction() {
    if (!interaction) return
    const { origin, target } = interaction
    if (!sameRect(origin, target)) {
      saveCards(cards.map((card) => card.itemId === origin.itemId ? { ...card, x: target.x, y: target.y, w: target.w, h: target.h } : card))
    }
    setInteraction(null)
  }

  function nudge(event, kind, card) {
    const step = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key]
    if (!step) return
    event.preventDefault()
    const next = kind === 'move'
      ? { ...card, x: card.x + step[0], y: card.y + step[1] }
      : { ...card, w: card.w + step[0], h: card.h + step[1] }
    if (fits(next, cards, card.itemId)) saveCards(cards.map((current) => current.itemId === card.itemId ? next : current))
  }

  function dropPosition(event, item) {
    const bounds = gridRef.current.getBoundingClientRect()
    const size = defaultSize(item, columnWidth)
    const x = clamp(Math.round((event.clientX - bounds.left) / columnWidth - size.w / 2), 0, COLUMNS - size.w)
    const y = Math.max(0, Math.round((event.clientY - bounds.top) / ROW - 1))
    return nearestFreeSlot(cards, { x, y, ...size })
  }

  const px = (rect) => ({
    left: rect.x * columnWidth + GAP / 2,
    top: rect.y * ROW + GAP / 2,
    width: rect.w * columnWidth - GAP,
    height: rect.h * ROW - GAP,
  })
  const active = interaction?.target ?? dropTarget?.rect
  const guides = interaction ? alignment(interaction.target, cards, interaction.itemId) : null
  const sizeMatch = interaction?.kind === 'resize' && guides.sizes.size > 0
    ? (guides.sizes.size === 2 ? 'Same size as a neighbour' : guides.sizes.has('width') ? 'Same width as a neighbour' : 'Same height as a neighbour')
    : null
  const rows = Math.max(bottomRow(cards), active ? active.y + active.h : 0) + 8
  const count = cards.length

  return (
    <div className="board-view">
      <header className="project-header board-header">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <button type="button" onClick={onBack}><NavArrowLeft className="ui-icon" aria-hidden="true" /> {project.title}</button>
          <span aria-hidden="true">/</span>
          <span>Boards</span>
        </nav>
        <div className="board-heading">
          <div className="board-heading-text">
            <input
              className="page-title"
              value={name}
              maxLength={120}
              aria-label="Board name"
              onChange={(event) => setName(event.target.value)}
              onBlur={commitName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
            <p className="board-meta">{count} item{count === 1 ? '' : 's'}</p>
          </div>
          <div className="board-actions">
            <button type="button" className="btn btn-primary" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(!drawerOpen)}>
              <Plus className="ui-icon" aria-hidden="true" /> Add from library
            </button>
            <Menu label="Board options">
              <button type="button" className="danger" onClick={deleteBoard}>Delete board</button>
            </Menu>
          </div>
        </div>
      </header>
      <div className="board-body">
        <div className="board-scroll">
          <div
            ref={gridRef}
            className={`board-grid-area${interaction || dropTarget ? ' is-arranging' : ''}`}
            style={{ height: rows * ROW, '--column': `${columnWidth}px`, '--row': `${ROW}px` }}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(DRAG_TYPE)) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
              const rect = dropPosition(event, draggedItem.current ?? { type: 'note' })
              if (!dropTarget || !sameRect(dropTarget.rect, rect)) setDropTarget({ rect })
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setDropTarget(null)
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDropTarget(null)
              const item = itemsById.get(event.dataTransfer.getData(DRAG_TYPE))
              if (item && !onBoard.has(item.id)) placeCard(item, dropPosition(event, item))
            }}
          >
            {width > 0 && cards.map((card) => {
              const item = itemsById.get(card.itemId)
              const isActive = interaction?.itemId === card.itemId
              const rect = isActive && interaction.kind === 'resize' ? interaction.target : card
              const style = px(rect)
              if (isActive && interaction.kind === 'move') style.transform = `translate(${interaction.dx}px, ${interaction.dy}px)`
              return (
                <article
                  key={card.itemId}
                  data-item-id={card.itemId}
                  className={`board-card-item is-${item.type}${isActive ? ` is-${interaction.kind === 'move' ? 'moving' : 'resizing'}` : ''}`}
                  style={style}
                  aria-label={itemTitle(item)}
                >
                  <div
                    className="board-card-bar"
                    onPointerDown={(event) => startInteraction(event, 'move', card)}
                    onPointerMove={moveInteraction}
                    onPointerUp={endInteraction}
                    onPointerCancel={() => setInteraction(null)}
                  >
                    <span className="board-card-title">{itemTitle(item)}</span>
                    <span className="board-card-kind">{item.type === 'image' ? 'Image' : 'Note'}</span>
                    <span className="section-spacer" />
                    <button
                      type="button"
                      className="icon-button card-move"
                      title="Move"
                      aria-label={`Move ${itemTitle(item)}. Use arrow keys to move by one grid step.`}
                      onKeyDown={(event) => nudge(event, 'move', card)}
                    ><DotsGrid3x3 className="ui-icon" aria-hidden="true" /></button>
                    <Menu label={`Options for ${itemTitle(item)}`}>
                      <button type="button" onClick={() => saveCards(cards.filter((current) => current.itemId !== card.itemId))}>Remove from board</button>
                    </Menu>
                  </div>
                  <div className="board-card-body">
                    <CardBody item={item} onEditNote={(content) => editNote(item.id, content)} onCommitNote={() => onPersist('items')} />
                  </div>
                  <button
                    type="button"
                    className="card-resize"
                    title="Resize"
                    aria-label={`Resize ${itemTitle(item)}. Use arrow keys to change width and height.`}
                    onPointerDown={(event) => startInteraction(event, 'resize', card)}
                    onPointerMove={moveInteraction}
                    onPointerUp={endInteraction}
                    onPointerCancel={() => setInteraction(null)}
                    onKeyDown={(event) => nudge(event, 'resize', card)}
                  />
                </article>
              )
            })}
            {width > 0 && active && <div className="board-drop-preview" style={px(active)} aria-hidden="true" />}
            {width > 0 && guides?.lines.map((line) => {
              const inset = line.edge === 'start' ? GAP / 2 : -GAP / 2
              const style = line.axis === 'x'
                ? { left: line.at * columnWidth + inset, top: line.from * ROW, height: (line.to - line.from) * ROW }
                : { top: line.at * ROW + inset, left: line.from * columnWidth, width: (line.to - line.from) * columnWidth }
              return <div key={`${line.axis}-${line.edge}-${line.at}`} className={`board-guide is-${line.axis}`} style={style} aria-hidden="true" />
            })}
            {width > 0 && sizeMatch && (
              <span className="board-snap-label" style={{ left: px(interaction.target).left, top: px(interaction.target).top + px(interaction.target).height + 8 }}>{sizeMatch}</span>
            )}
            {cards.length === 0 && !dropTarget && (
              <p className="board-empty">Add notes and images from the library to compare them here.</p>
            )}
          </div>
        </div>
        {drawerOpen && (
          <LibraryDrawer
            items={project.items}
            onBoard={onBoard}
            onAdd={addItem}
            onNewNote={addNewNote}
            onDragItem={(item) => { draggedItem.current = item }}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </div>
    </div>
  )
}
