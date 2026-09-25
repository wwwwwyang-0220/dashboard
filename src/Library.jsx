import { useEffect, useRef, useState } from 'react'
import { MediaImage, Plus, Trash } from 'iconoir-react'
import { Ring } from 'loading-dev'

import { formatDate, imageUrl, itemTitle, newNote, readImageSize } from './items.js'

const FILTERS = [['all', 'All'], ['note', 'Notes'], ['image', 'Images']]

// Deleting an item also takes it off every board, so boards never point at missing items.
function removeItemChanges(project, id) {
  return {
    boards: project.boards.map((board) => ({ ...board, cards: board.cards.filter((card) => card.itemId !== id) })),
    items: project.items.filter((item) => item.id !== id),
  }
}

function ItemDialog({ item, boardCount, onUpdate, onCommit, onDelete, onClose }) {
  const dialogRef = useRef(null)

  // No cleanup: closing would fire `close` and dismiss the item. Unmounting removes the dialog.
  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])

  function remove() {
    const where = boardCount > 0 ? ` It will also be removed from ${boardCount} board${boardCount === 1 ? '' : 's'}.` : ''
    if (window.confirm(`Delete “${itemTitle(item)}”?${where}`)) onDelete()
  }

  return (
    <dialog
      ref={dialogRef}
      className={`item-dialog is-${item.type}`}
      aria-label={itemTitle(item)}
      onClose={() => {
        onCommit()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <div className="item-dialog-body">
        <div className="item-dialog-top">
          <span className="item-kind">{item.type === 'image' ? 'Image' : 'Note'} · {formatDate(item.createdAt) || 'earlier'}</span>
          <div className="item-dialog-actions">
            <button type="button" className="text-button danger" onClick={remove}><Trash className="ui-icon" aria-hidden="true" /> Delete</button>
            <button type="button" className="text-button" onClick={() => dialogRef.current.close()}>Done</button>
          </div>
        </div>
        <input
          className="item-dialog-title"
          value={item.title}
          maxLength={120}
          placeholder={item.type === 'image' ? 'Untitled image' : 'Untitled note'}
          aria-label="Title"
          onChange={(event) => onUpdate({ title: event.target.value })}
          onBlur={onCommit}
        />
        {item.type === 'note' ? (
          <textarea
            className="item-dialog-text"
            value={item.content}
            maxLength={20000}
            placeholder="Write something…"
            aria-label="Note"
            autoFocus={!item.content}
            onChange={(event) => onUpdate({ content: event.target.value })}
            onBlur={onCommit}
          />
        ) : (
          <img className="item-dialog-image" src={imageUrl(item)} alt={itemTitle(item)} />
        )}
      </div>
    </dialog>
  )
}

function ItemCard({ item, onOpen }) {
  return (
    <button type="button" className={`library-card is-${item.type}`} onClick={onOpen}>
      {item.type === 'image' ? (
        <>
          <span className="library-thumb"><img src={imageUrl(item)} alt="" loading="lazy" /></span>
          <span className="library-card-label">
            <span className="library-card-title">{itemTitle(item)}</span>
            <span className="library-card-meta">Image · {formatDate(item.createdAt) || 'earlier'}</span>
          </span>
        </>
      ) : (
        <>
          <span className="library-card-meta is-caps">Note · {formatDate(item.updatedAt ?? item.createdAt) || 'earlier'}</span>
          <span className="library-card-title is-note">{itemTitle(item)}</span>
          <span className="library-card-preview">{item.content}</span>
        </>
      )}
    </button>
  )
}

export default function Library({ project, onChange, onPersist, onUploadImage, onError }) {
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [uploading, setUploading] = useState(0)
  const fileInput = useRef(null)
  const items = [...project.items].reverse()
  const shown = filter === 'all' ? items : items.filter((item) => item.type === filter)
  const openItem = project.items.find((item) => item.id === openId)
  const count = (type) => type === 'all' ? items.length : items.filter((item) => item.type === type).length

  function createNote() {
    const note = newNote()
    onChange({ items: [...project.items, note] }, ['items'])
    setOpenId(note.id)
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
    onChange({ items: project.items.map((item) => item.id === id ? { ...item, ...changes, updatedAt: new Date().toISOString() } : item) }, [])
  }

  return (
    <section className="library" aria-labelledby="library-heading">
      <div className="section-header">
        <h2 id="library-heading">Library</h2>
        <div className="segmented" role="group" aria-label="Show">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {label} <span>{count(value)}</span>
            </button>
          ))}
        </div>
        <span className="section-spacer" />
        {uploading > 0 && <span className="upload-status" role="status"><Ring size={14} duration={1400} /> Uploading…</span>}
        <button type="button" className="secondary-button" onClick={createNote}><Plus className="ui-icon" aria-hidden="true" /> New note</button>
        <button type="button" className="secondary-button" onClick={() => fileInput.current.click()}><MediaImage className="ui-icon" aria-hidden="true" /> Add image</button>
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
      {shown.length > 0 ? (
        <div className="library-grid">
          {shown.map((item) => <ItemCard key={item.id} item={item} onOpen={() => setOpenId(item.id)} />)}
        </div>
      ) : (
        <p className="section-empty">{items.length === 0 ? 'Add notes and images you want to keep with this project.' : 'Nothing here yet.'}</p>
      )}
      {openItem && (
        <ItemDialog
          key={openItem.id}
          item={openItem}
          boardCount={project.boards.filter((board) => board.cards.some((card) => card.itemId === openItem.id)).length}
          onUpdate={(changes) => updateItem(openItem.id, changes)}
          onCommit={() => onPersist('items')}
          onDelete={() => {
            setOpenId(null)
            onChange(removeItemChanges(project, openItem.id), ['boards', 'items'])
          }}
          onClose={() => setOpenId(null)}
        />
      )}
    </section>
  )
}
