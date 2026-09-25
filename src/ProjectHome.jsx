import { Plus } from 'iconoir-react'

import { bottomRow, COLUMNS } from './board-layout.js'
import { formatDate } from './items.js'
import Library from './Library.jsx'
import TodoList from './TodoList.jsx'
import './Workspace.css'

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

function BoardList({ project, onOpenBoard, onChange }) {
  function createBoard() {
    const board = { id: crypto.randomUUID(), name: 'Untitled board', updatedAt: new Date().toISOString(), cards: [] }
    onChange({ boards: [...project.boards, board] }, ['boards'])
    onOpenBoard(board.id)
  }

  return (
    <section className="boards" aria-labelledby="boards-heading">
      <div className="section-header">
        <h2 id="boards-heading">Boards</h2>
        <span className="section-count">{project.boards.length}</span>
        <span className="section-spacer" />
        <button type="button" className="secondary-button" onClick={createBoard}><Plus className="ui-icon" aria-hidden="true" /> New board</button>
      </div>
      {project.boards.length > 0 ? (
        <div className="board-grid">
          {project.boards.map((board) => {
            const count = board.cards.filter((card) => project.items.some((item) => item.id === card.itemId)).length
            return (
              <button key={board.id} type="button" className="board-card" onClick={() => onOpenBoard(board.id)}>
                <BoardPreview board={board} items={project.items} />
                <span className="board-card-label">
                  <span className="board-card-name">{board.name}</span>
                  <span className="board-card-meta">{count} item{count === 1 ? '' : 's'}{board.updatedAt ? ` · edited ${formatDate(board.updatedAt)}` : ''}</span>
                </span>
              </button>
            )
          })}
        </div>
      ) : (
        <p className="section-empty">Boards put notes and images side by side. Create one when you want to compare.</p>
      )}
    </section>
  )
}

export default function ProjectHome({ project, onOpenBoard, onChange, onPersist, onUploadImage, onError }) {
  return (
    <div className="project-home">
      <TodoList todos={project.todos} onChange={onChange} onPersist={onPersist} />
      <div className="project-home-main">
        <BoardList project={project} onOpenBoard={onOpenBoard} onChange={onChange} />
        <Library project={project} onChange={onChange} onPersist={onPersist} onUploadImage={onUploadImage} onError={onError} />
      </div>
    </div>
  )
}
