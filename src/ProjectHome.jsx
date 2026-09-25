import { Plus } from 'iconoir-react'

import { bottomRow, COLUMNS, placeItems } from './board-layout.js'
import { formatDate } from './items.js'
import Library from './Library.jsx'
import TodoList from './TodoList.jsx'
import './Workspace.css'

// A board opens with the sidebar collapsed and its canvas spans the window; its column width sizes new cards.
const boardColumnWidth = () => (window.innerWidth - 48) / COLUMNS

function BoardPreview({ board, items }) {
  const rows = Math.max(bottomRow(board.cards), 10)
  const typeOf = new Map(items.map((item) => [item.id, item.type]))
  return (
    <svg className="board-preview" viewBox={`-1 -1 ${COLUMNS + 2} ${rows + 2}`} preserveAspectRatio="xMidYMin slice" aria-hidden="true">
      {board.cards.filter((card) => typeOf.has(card.itemId)).map((card) => (
        <rect
          key={card.itemId}
          className={typeOf.get(card.itemId) === 'image' ? 'is-image' : 'is-note'}
          x={card.x + 0.3}
          y={card.y + 0.3}
          width={card.w - 0.6}
          height={card.h - 0.6}
          rx="0.4"
        />
      ))}
    </svg>
  )
}

// Boards, most recently edited first; the latest one is where work usually continues.
function BoardList({ project, onOpenBoard, onCreateBoard }) {
  const boards = [...project.boards].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))

  return (
    <section className="boards" aria-labelledby="boards-heading">
      <div className="section-header">
        <h2 id="boards-heading">Boards</h2>
        <span className="section-count">{boards.length}</span>
        <span className="section-spacer" />
        <button type="button" className="btn btn-quiet" onClick={() => onCreateBoard([])}><Plus className="ui-icon" aria-hidden="true" /> New board</button>
      </div>
      {boards.length > 0 ? (
        <div className="board-list">
          {boards.map((board, index) => {
            const count = board.cards.filter((card) => project.items.some((item) => item.id === card.itemId)).length
            return (
              <button key={board.id} type="button" className={`board-row${index === 0 ? ' is-recent' : ''}`} onClick={() => onOpenBoard(board.id)}>
                <BoardPreview board={board} items={project.items} />
                <span className="board-row-label">
                  <span className="board-row-name">{board.name}</span>
                  <span className="board-row-meta">{count} item{count === 1 ? '' : 's'}{board.updatedAt ? ` · edited ${formatDate(board.updatedAt)}` : ''}</span>
                </span>
                {index === 0 && <span className="board-row-continue">Continue</span>}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="section-empty">Select notes and images in the library to compare them on a board.</p>
      )}
    </section>
  )
}

export default function ProjectHome({ project, onOpenBoard, onChange, onPersist, onUploadImage, onError, searchTarget, onClearSearchTarget }) {
  const itemsFor = (current, ids) => ids.map((id) => current.items.find((item) => item.id === id)).filter(Boolean)

  function createBoard(itemIds) {
    const board = { id: crypto.randomUUID(), name: 'Untitled board', updatedAt: new Date().toISOString(), cards: placeItems([], itemsFor(project, itemIds), boardColumnWidth()) }
    onChange((current) => ({ boards: [...current.boards, board] }), ['boards'])
    onOpenBoard(board.id)
  }

  function addToBoard(boardId, itemIds) {
    onChange((current) => ({
      boards: current.boards.map((board) => board.id === boardId
        ? { ...board, cards: placeItems(board.cards, itemsFor(current, itemIds), boardColumnWidth()), updatedAt: new Date().toISOString() }
        : board),
    }), ['boards'])
  }

  return (
    <div className="project-home">
      <Library
        project={project}
        onChange={onChange}
        onPersist={onPersist}
        onUploadImage={onUploadImage}
        onError={onError}
        onOpenBoard={onOpenBoard}
        onCreateBoard={createBoard}
        onAddToBoard={addToBoard}
        searchTarget={searchTarget}
        onClearSearchTarget={onClearSearchTarget}
      />
      <aside className="project-rail" aria-label="To-dos and boards">
        <TodoList todos={project.todos} onChange={onChange} onPersist={onPersist} />
        <BoardList project={project} onOpenBoard={onOpenBoard} onCreateBoard={createBoard} />
      </aside>
    </div>
  )
}
