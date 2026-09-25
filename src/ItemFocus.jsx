import { useEffect, useLayoutEffect, useRef } from 'react'
import { Xmark } from 'iconoir-react'

import { formatDate, imageUrl, itemTitle } from './items.js'

const SAVE_DELAY = 800
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

// The transform that makes the dialog cover `origin`, the card it opened from.
function coverTransform(dialog, origin) {
  const box = dialog.getBoundingClientRect()
  const dx = origin.left + origin.width / 2 - (box.left + box.width / 2)
  const dy = origin.top + origin.height / 2 - (box.top + box.height / 2)
  return `translate(${dx}px, ${dy}px) scale(${origin.width / box.width}, ${origin.height / box.height})`
}

// One note or image, enlarged in the middle of the screen over a dimmed, blurred
// page. It grows out of its card and shrinks back into it. Edits save as you type.
export default function ItemFocus({ item, boards, getOrigin, onUpdate, onCommit, onOpenBoard, onClose }) {
  const dialogRef = useRef(null)
  const closing = useRef(false)
  const latest = useRef({ onCommit, getOrigin })
  const edited = useRef(false)

  useLayoutEffect(() => {
    latest.current = { onCommit, getOrigin }
  })

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog.open) dialog.showModal()
    // Start typing straight away in an empty note; otherwise focus the dialog, not its first control.
    const text = dialog.querySelector('textarea')
    if (text && !text.value) text.focus()
    else dialog.focus()
    const origin = latest.current.getOrigin()
    if (origin && !reduceMotion()) {
      dialog.animate([{ transform: coverTransform(dialog, origin), opacity: 0.3 }, { transform: 'none', opacity: 1 }], { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' })
    }
    // Runs once: the dialog opens when it mounts; the origin is read again at close.
  }, [])

  useEffect(() => {
    if (!edited.current) return
    const timer = setTimeout(() => latest.current.onCommit(), SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [item.title, item.content])

  function update(changes) {
    edited.current = true
    onUpdate(changes)
  }

  function close() {
    if (closing.current) return
    closing.current = true
    if (edited.current) onCommit()
    const dialog = dialogRef.current
    const origin = getOrigin()
    if (!origin || reduceMotion()) {
      dialog.close()
      return
    }
    dialog.classList.add('is-closing')
    dialog.animate([{ transform: 'none', opacity: 1 }, { transform: coverTransform(dialog, origin), opacity: 0 }], { duration: 180, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' })
      .finished.then(() => dialog.close())
  }

  function openBoard(id) {
    if (edited.current) onCommit()
    onOpenBoard(id)
  }

  return (
    <dialog
      ref={dialogRef}
      className={`item-focus is-${item.type}`}
      tabIndex={-1}
      aria-label={itemTitle(item)}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="item-focus-body">
        <div className="item-focus-top">
          <span className="item-kind">{item.type === 'image' ? 'Image' : 'Note'} · {formatDate(item.createdAt) || 'earlier'}</span>
          <button type="button" className="icon-button" aria-label="Close" title="Close" onClick={close}><Xmark className="ui-icon" aria-hidden="true" /></button>
        </div>
        <input
          className="item-focus-title"
          value={item.title}
          maxLength={120}
          placeholder={item.type === 'image' ? 'Untitled image' : 'Title'}
          aria-label="Title"
          onChange={(event) => update({ title: event.target.value })}
        />
        {item.type === 'note' ? (
          <textarea
            className="item-focus-text"
            value={item.content}
            maxLength={20000}
            placeholder="Write something…"
            aria-label="Note"
            onChange={(event) => update({ content: event.target.value })}
          />
        ) : (
          <img className="item-focus-image" src={imageUrl(item)} alt={itemTitle(item)} />
        )}
        <div className="item-focus-footer">
          {boards.length > 0 && (
            <span className="item-focus-boards">
              On board:
              {boards.map((board, index) => (
                <span key={board.id}>
                  <button type="button" onClick={() => openBoard(board.id)}>{board.name}</button>{index < boards.length - 1 && ','}
                </span>
              ))}
            </span>
          )}
          <span className="item-focus-hint">Edits save as you type · Esc to close</span>
        </div>
      </div>
    </dialog>
  )
}
