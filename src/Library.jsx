import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Check, MediaImage, NavArrowDown, NavArrowRight } from 'iconoir-react'
import { Ring } from 'loading-dev'

import ItemFocus from './ItemFocus.jsx'
import { boardsWith, groupByDate, imageUrl, itemTitle, newNote, readImageSize } from './items.js'

const FILTERS = [['all', 'All'], ['note', 'Notes'], ['image', 'Images']]
const CARD_MIN = 220
const COLUMN_GAP = 16
const LONG_PRESS = 500

// Deleting items also takes them off every board, so boards never point at missing items.
function removeItemsChanges(project, ids) {
  const gone = new Set(ids)
  return {
    boards: project.boards.map((board) => ({ ...board, cards: board.cards.filter((card) => !gone.has(card.itemId)) })),
    items: project.items.filter((item) => !gone.has(item.id)),
  }
}

function confirmDelete(project, ids) {
  const boardCount = project.boards.filter((board) => board.cards.some((card) => ids.includes(card.itemId))).length
  const what = ids.length === 1 ? `“${itemTitle(project.items.find((item) => item.id === ids[0]))}”` : `${ids.length} items`
  const where = boardCount > 0 ? ` ${ids.length === 1 ? 'It' : 'They'} will also be removed from ${boardCount} board${boardCount === 1 ? '' : 's'}.` : ''
  return window.confirm(`Delete ${what}?${where}`)
}

// Closes a popover on a pointer press outside `ref` or on Escape.
function useDismiss(ref, active, onDismiss) {
  const dismiss = useRef(onDismiss)
  useLayoutEffect(() => {
    dismiss.current = onDismiss
  })
  useEffect(() => {
    if (!active) return
    function outside(event) {
      if (!ref.current?.contains(event.target)) dismiss.current()
    }
    function escape(event) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        dismiss.current()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape, true)
    }
  }, [ref, active])
}

function QuickCapture({ dropping, onSave, onImages }) {
  const [text, setText] = useState('')

  function save() {
    const content = text.trim()
    if (!content) return
    onSave(content)
    setText('')
  }

  return (
    <div className={`capture${dropping ? ' is-dropping' : ''}`}>
      <textarea
        value={text}
        rows={1}
        maxLength={20000}
        placeholder="Write a note…"
        aria-label="New note"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            save()
          }
        }}
        onPaste={(event) => {
          const images = [...event.clipboardData.files].filter((file) => file.type.startsWith('image/'))
          if (images.length === 0) return
          event.preventDefault()
          onImages(images)
        }}
      />
      <div className="capture-footer">
        <span>{dropping ? 'Drop to add the image' : 'Paste or drop an image to add it'}</span>
        <span className="section-spacer" />
        {text.trim()
          ? <button type="button" className="btn btn-primary" onClick={save}>Save <span className="capture-key">⌘ Enter</span></button>
          : <span>⌘ Enter to save</span>}
      </div>
    </div>
  )
}

function LibraryCard({ item, when, selecting, selected, onOpen, onToggle, onMenu }) {
  const press = useRef(null)
  const title = itemTitle(item)
  const ratio = item.type === 'image' && item.width && item.height ? Math.max(0.75, Math.min(2, item.width / item.height)) : null

  // A long press on a touch screen opens the same menu as a right click.
  function pointerDown(event) {
    if (event.pointerType !== 'touch') return
    const at = { x: event.clientX, y: event.clientY }
    press.current = { ...at, fired: false }
    press.current.timer = setTimeout(() => {
      press.current.fired = true
      onMenu(at)
    }, LONG_PRESS)
  }

  function pointerMove(event) {
    if (press.current && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 10) clearTimeout(press.current.timer)
  }

  function click() {
    const fired = press.current?.fired
    press.current = null
    if (fired) return
    if (selecting) onToggle()
    else onOpen()
  }

  return (
    <article
      className={`library-card is-${item.type}${selected ? ' is-selected' : ''}`}
      data-item-id={item.id}
      onContextMenu={(event) => {
        event.preventDefault()
        onMenu({ x: event.clientX, y: event.clientY })
      }}
    >
      <button
        type="button"
        className="library-card-open"
        aria-pressed={selecting ? selected : undefined}
        onClick={click}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={() => clearTimeout(press.current?.timer)}
        onPointerCancel={() => clearTimeout(press.current?.timer)}
      >
        {item.type === 'image' ? (
          <>
            <span className="library-thumb" style={{ aspectRatio: ratio ?? '16 / 10' }}><img src={imageUrl(item)} alt="" loading="lazy" /></span>
            <span className="library-card-label">
              <span className="library-card-title">{title}</span>
              <span className="library-card-meta">Image{when && ` · ${when}`}</span>
            </span>
          </>
        ) : (
          <>
            <span className="library-card-meta">Note{when && ` · ${when}`}</span>
            {item.title.trim() && <span className="library-card-title is-note">{item.title}</span>}
            {item.content.trim()
              ? <span className="library-card-preview">{item.content}</span>
              : !item.title.trim() && <span className="library-card-preview is-empty">Empty note</span>}
          </>
        )}
      </button>
      <button type="button" className="card-check" aria-label={`${selected ? 'Deselect' : 'Select'} ${title}`} aria-pressed={selected} onClick={onToggle}>
        {selected && <Check className="ui-icon" aria-hidden="true" />}
      </button>
    </article>
  )
}

function CardMenu({ at, item, boards, onOpen, onSelect, onAddToBoard, onNewBoard, onDelete, onClose }) {
  const ref = useRef(null)
  const [submenu, setSubmenu] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const placed = new Set(boardsWith({ boards }, item.id).map((board) => board.id))
  useDismiss(ref, true, onClose)

  // Keep the menu on screen, and open the submenu leftwards when there is no room on the right.
  useLayoutEffect(() => {
    const menu = ref.current
    const { width, height } = menu.getBoundingClientRect()
    const x = Math.max(8, Math.min(at.x, window.innerWidth - width - 8))
    menu.style.left = `${x}px`
    menu.style.top = `${Math.max(8, Math.min(at.y, window.innerHeight - height - 8))}px`
    setFlipped(x + width * 2 + 8 > window.innerWidth)
    menu.querySelector('button').focus()
  }, [at])

  const run = (action) => () => {
    onClose()
    action()
  }

  return (
    <div ref={ref} className="context-menu" role="menu" aria-label={itemTitle(item)}>
      <button type="button" role="menuitem" onClick={run(onOpen)}>Open</button>
      <button type="button" role="menuitem" onClick={run(onSelect)}>Select</button>
      <div className="context-submenu" onPointerEnter={() => setSubmenu(true)} onPointerLeave={() => setSubmenu(false)}>
        <button
          type="button"
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={submenu}
          className={submenu ? 'is-active' : undefined}
          onClick={() => setSubmenu(!submenu)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') setSubmenu(true)
          }}
        >
          Add to board <NavArrowRight className="ui-icon" aria-hidden="true" />
        </button>
        {submenu && (
          <div className={`context-menu is-sub${flipped ? ' is-flipped' : ''}`} role="menu" aria-label="Add to board">
            {boards.map((board) => (
              <button key={board.id} type="button" role="menuitem" disabled={placed.has(board.id)} onClick={run(() => onAddToBoard(board.id))}>
                <span>{board.name}</span>
                {placed.has(board.id) && <Check className="ui-icon" aria-label="Already on this board" />}
              </button>
            ))}
            <button type="button" role="menuitem" className="is-secondary" onClick={run(onNewBoard)}>New board…</button>
          </div>
        )}
      </div>
      <hr />
      <button type="button" role="menuitem" className="danger" onClick={run(onDelete)}>Delete</button>
    </div>
  )
}

function SelectionBar({ count, boards, onDelete, onAddToBoard, onCompare }) {
  const [picking, setPicking] = useState(false)
  const pickerRef = useRef(null)
  useDismiss(pickerRef, picking, () => setPicking(false))

  return (
    <div className="selection-bar" role="toolbar" aria-label="Selected items">
      <span className="selection-count">{count} selected</span>
      <span className="selection-divider" aria-hidden="true" />
      <button type="button" className="btn btn-quiet is-danger" onClick={onDelete}>Delete</button>
      {boards.length > 0 && (
        <div className="menu" ref={pickerRef}>
          <button type="button" className="btn btn-quiet" aria-expanded={picking} onClick={() => setPicking(!picking)}>
            Add to board <NavArrowDown className="ui-icon" aria-hidden="true" />
          </button>
          {picking && (
            <div className="menu-popover is-up">
              {boards.map((board) => (
                <button key={board.id} type="button" onClick={() => {
                  setPicking(false)
                  onAddToBoard(board.id)
                }}>{board.name}</button>
              ))}
            </div>
          )}
        </div>
      )}
      <button type="button" className="btn btn-primary" onClick={onCompare}>Compare on a new board</button>
    </div>
  )
}

export default function Library({ project, onChange, onPersist, onUploadImage, onError, onOpenBoard, onCreateBoard, onAddToBoard }) {
  const [filter, setFilter] = useState('all')
  const [focusId, setFocusId] = useState(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [menu, setMenu] = useState(null)
  const [uploading, setUploading] = useState(0)
  const [dropping, setDropping] = useState(false)
  const [notice, setNotice] = useState(null)
  const [columns, setColumns] = useState(3)
  const streamRef = useRef(null)
  const fileInput = useRef(null)

  const itemIds = new Set(project.items.map((item) => item.id))
  const selectedIds = [...selected].filter((id) => itemIds.has(id))
  const selecting = selectMode || selectedIds.length > 0
  const shown = filter === 'all' ? project.items : project.items.filter((item) => item.type === filter)
  const groups = groupByDate(shown)
  const count = (type) => type === 'all' ? project.items.length : project.items.filter((item) => item.type === type).length
  const focusItem = project.items.find((item) => item.id === focusId)
  const menuItem = project.items.find((item) => item.id === menu?.itemId)

  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const fit = Math.floor((entry.contentRect.width + COLUMN_GAP) / (CARD_MIN + COLUMN_GAP))
      setColumns(Math.max(1, Math.min(4, fit)))
    })
    observer.observe(streamRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!selecting || focusId || menu) return
    function escape(event) {
      if (event.key === 'Escape') clearSelection()
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [selecting, focusId, menu])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  function clearSelection() {
    setSelected(new Set())
    setSelectMode(false)
  }

  function toggle(id) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function saveNote(content) {
    const note = { ...newNote(), content }
    onChange((current) => ({ items: [...current.items, note] }), ['items'])
  }

  async function addImages(files) {
    const images = [...files].filter((file) => file.type.startsWith('image/'))
    setUploading((current) => current + images.length)
    for (const file of images) {
      try {
        const [stored, size] = await Promise.all([onUploadImage(file), readImageSize(file)])
        const now = new Date().toISOString()
        const item = { id: crypto.randomUUID(), type: 'image', title: file.name.replace(/\.[^.]+$/, '').slice(0, 120), file: stored, ...size, createdAt: now, updatedAt: now }
        onChange((current) => ({ items: [...current.items, item] }), ['items'])
      } catch (error) {
        onError(error.message)
      } finally {
        setUploading((current) => current - 1)
      }
    }
  }

  function updateItem(id, changes) {
    onChange((current) => ({ items: current.items.map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) }))
  }

  function deleteItems(ids) {
    if (!confirmDelete(project, ids)) return
    onChange((current) => removeItemsChanges(current, ids), ['boards', 'items'])
    setSelected((current) => new Set([...current].filter((id) => !ids.includes(id))))
  }

  function addToBoard(boardId, ids) {
    onAddToBoard(boardId, ids)
    setNotice({ boardId, text: `Added ${ids.length === 1 ? '1 item' : `${ids.length} items`} to ${project.boards.find((board) => board.id === boardId)?.name}` })
  }

  const cardOrigin = (id) => () => streamRef.current?.querySelector(`[data-item-id="${id}"]`)?.getBoundingClientRect()

  return (
    <section
      className="library"
      aria-labelledby="library-heading"
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes('Files')) return
        event.preventDefault()
        setDropping(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setDropping(false)
      }}
      onDrop={(event) => {
        if (event.dataTransfer.files.length === 0) return
        event.preventDefault()
        setDropping(false)
        addImages(event.dataTransfer.files)
      }}
    >
      <div className="section-header">
        <h2 id="library-heading">Library</h2>
        <span className="section-count">{project.items.length}</span>
        <div className="segmented" role="group" aria-label="Show">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label}{value !== 'all' && <span> {count(value)}</span>}
            </button>
          ))}
        </div>
        <span className="section-spacer" />
        {uploading > 0 && <span className="upload-status" role="status"><Ring size={14} duration={1400} /> Uploading…</span>}
        {selecting ? (
          <>
            <span className="selection-status" role="status">{selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Choose items'}</span>
            <button type="button" className="btn btn-quiet" onClick={clearSelection}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-quiet" onClick={() => setSelectMode(true)} disabled={project.items.length === 0}>Select</button>
            <button type="button" className="btn btn-quiet" onClick={() => fileInput.current.click()}><MediaImage className="ui-icon" aria-hidden="true" /> Add image</button>
          </>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          multiple
          hidden
          onChange={(event) => {
            addImages(event.target.files)
            event.target.value = ''
          }}
        />
      </div>
      <div className="library-capture" inert={selecting}>
        <QuickCapture dropping={dropping} onSave={saveNote} onImages={addImages} />
      </div>
      <div ref={streamRef} className={`library-stream${selecting ? ' is-selecting' : ''}`}>
        {groups.map((group) => (
          <section key={group.key} className="library-group" aria-labelledby={`group-${group.key}`}>
            <h3 id={`group-${group.key}`} className="library-group-header">
              {group.label}
              {group.detail && <span>{group.detail}</span>}
            </h3>
            <div className="library-columns">
              {Array.from({ length: columns }, (_, column) => (
                <div key={column} className="library-column">
                  {group.entries.filter((_, index) => index % columns === column).map(({ item, when }) => (
                    <LibraryCard
                      key={item.id}
                      item={item}
                      when={when}
                      selecting={selecting}
                      selected={selected.has(item.id)}
                      onOpen={() => setFocusId(item.id)}
                      onToggle={() => toggle(item.id)}
                      onMenu={(at) => setMenu({ itemId: item.id, at })}
                    />
                  ))}
                </div>
              ))}
            </div>
          </section>
        ))}
        {shown.length === 0 && <p className="section-empty">{project.items.length === 0 ? 'Write a note or drop an image above to start this project’s library.' : 'Nothing here yet.'}</p>}
      </div>
      {selecting && selectedIds.length > 0 && (
        <SelectionBar
          count={selectedIds.length}
          boards={project.boards}
          onDelete={() => deleteItems(selectedIds)}
          onAddToBoard={(boardId) => {
            addToBoard(boardId, selectedIds)
            clearSelection()
          }}
          onCompare={() => onCreateBoard(selectedIds)}
        />
      )}
      {notice && !selecting && (
        <div className="library-notice" role="status">
          {notice.text}
          <button type="button" onClick={() => onOpenBoard(notice.boardId)}>Open board</button>
        </div>
      )}
      {menuItem && (
        <CardMenu
          at={menu.at}
          item={menuItem}
          boards={project.boards}
          onOpen={() => setFocusId(menuItem.id)}
          onSelect={() => toggle(menuItem.id)}
          onAddToBoard={(boardId) => addToBoard(boardId, [menuItem.id])}
          onNewBoard={() => onCreateBoard([menuItem.id])}
          onDelete={() => deleteItems([menuItem.id])}
          onClose={() => setMenu(null)}
        />
      )}
      {focusItem && (
        <ItemFocus
          key={focusItem.id}
          item={focusItem}
          boards={boardsWith(project, focusItem.id)}
          getOrigin={cardOrigin(focusItem.id)}
          onUpdate={(changes) => updateItem(focusItem.id, changes)}
          onCommit={() => onPersist('items')}
          onOpenBoard={onOpenBoard}
          onClose={() => setFocusId(null)}
        />
      )}
    </section>
  )
}
