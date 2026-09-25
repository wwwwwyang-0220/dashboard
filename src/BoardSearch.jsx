import { useEffect, useRef, useState } from 'react'
import { Check, Search } from 'iconoir-react'

import { imageUrl, itemTitle } from './items.js'

const LIMIT = 8

function matches(item, needle) {
  return !needle
    || item.title.toLowerCase().includes(needle)
    || (item.type === 'note' && item.content.toLowerCase().includes(needle))
}

function snippet(item) {
  if (item.type === 'image') return 'Image'
  const text = item.content.replace(/\s+/g, ' ').trim()
  return item.title.trim() ? text : ''
}

// Finds a note or image in this project's library and adds it to the board. Items not yet
// on the board come first; choosing one that is already there shows it instead.
export default function BoardSearch({ projectTitle, items, onBoard, onChoose, onClose }) {
  const dialogRef = useRef(null)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const needle = query.trim().toLowerCase()
  const results = [...items]
    .filter((item) => matches(item, needle))
    .sort((a, b) => Number(onBoard.has(a.id)) - Number(onBoard.has(b.id)) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
    .slice(0, LIMIT)
  const current = Math.min(active, results.length - 1)

  useEffect(() => {
    if (!dialogRef.current.open) dialogRef.current.showModal()
  }, [])

  function choose(item) {
    dialogRef.current.close()
    onChoose(item)
  }

  function onKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current + step + results.length) % Math.max(results.length, 1))
    } else if (event.key === 'Enter' && results[current]) {
      event.preventDefault()
      choose(results[current])
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="board-search"
      aria-label="Add to board"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
    >
      <div className="board-search-field">
        <Search className="ui-icon" aria-hidden="true" />
        <input
          autoFocus
          type="search"
          value={query}
          maxLength={120}
          placeholder="Find a note or image to add"
          aria-label="Find a note or image to add"
          aria-controls="board-search-results"
          aria-activedescendant={results[current] ? `board-search-${results[current].id}` : undefined}
          onChange={(event) => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
        />
        <span className="board-search-scope">{projectTitle}</span>
      </div>
      <ul id="board-search-results" className="board-search-results" role="listbox" aria-label="Library items">
        {results.map((item, index) => {
          const placed = onBoard.has(item.id)
          const detail = snippet(item)
          return (
            <li
              key={item.id}
              id={`board-search-${item.id}`}
              role="option"
              aria-selected={index === current}
              className={index === current ? 'is-active' : undefined}
              onPointerMove={() => setActive(index)}
              onClick={() => choose(item)}
            >
              <span className={`drawer-thumb is-${item.type}`}>
                {item.type === 'image' ? <img src={imageUrl(item)} alt="" loading="lazy" /> : <span />}
              </span>
              <span className="board-search-text">
                <span className="board-search-title">{itemTitle(item)}</span>
                {detail && <span className="board-search-detail">{detail}</span>}
              </span>
              {placed
                ? <span className="board-search-status is-placed"><Check className="ui-icon" aria-hidden="true" /> On board</span>
                : index === current && <span className="board-search-status">↵ Add to board</span>}
            </li>
          )
        })}
        {results.length === 0 && <li className="board-search-empty" role="presentation">{items.length === 0 ? 'The library is empty.' : `No notes or images match “${query.trim()}”.`}</li>}
      </ul>
      <div className="board-search-footer" aria-hidden="true">
        <span>↵ Add to the middle of the board</span>
        <span>↑↓ Move</span>
        <span>Esc Close</span>
      </div>
    </dialog>
  )
}
