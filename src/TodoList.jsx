import { useEffect, useState } from 'react'
import { NavArrowDown, NavArrowRight, Plus, Xmark } from 'iconoir-react'

function readCompletedOpen() {
  try {
    return localStorage.getItem('dashboard.completedOpen') === 'true'
  } catch {
    return false
  }
}

function TodoRow({ todo, onUpdate, onCommit, onRemove }) {
  return (
    <li className={`todo-row${todo.done ? ' is-done' : ''}`}>
      <input
        type="checkbox"
        checked={todo.done}
        aria-label={`${todo.done ? 'Reopen' : 'Complete'} ${todo.text || 'task'}`}
        onChange={(event) => onUpdate({ done: event.target.checked, doneAt: event.target.checked ? new Date().toISOString() : null }, true)}
      />
      <textarea
        className="todo-text"
        value={todo.text}
        rows={1}
        maxLength={500}
        aria-label="Task"
        onChange={(event) => onUpdate({ text: event.target.value.replace(/\n/g, ' ') }, false)}
        onBlur={() => todo.text.trim() ? onCommit() : onRemove()}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          }
        }}
      />
      <button type="button" className="todo-remove" aria-label={`Delete ${todo.text || 'task'}`} onClick={onRemove}>
        <Xmark className="ui-icon" aria-hidden="true" />
      </button>
    </li>
  )
}

export default function TodoList({ todos, onChange, onPersist }) {
  const [draft, setDraft] = useState('')
  const [completedOpen, setCompletedOpen] = useState(readCompletedOpen)
  const open = todos.filter((todo) => !todo.done)
  const done = todos.filter((todo) => todo.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))

  useEffect(() => {
    try {
      localStorage.setItem('dashboard.completedOpen', String(completedOpen))
    } catch {
      // Remembering the fold is a convenience; the list works without it.
    }
  }, [completedOpen])

  function add(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    onChange({ todos: [...todos, { id: crypto.randomUUID(), text, done: false, doneAt: null }] }, ['todos'])
    setDraft('')
  }

  function update(id, changes, persist) {
    onChange({ todos: todos.map((todo) => todo.id === id ? { ...todo, ...changes } : todo) }, persist ? ['todos'] : [])
  }

  function remove(id) {
    onChange({ todos: todos.filter((todo) => todo.id !== id) }, ['todos'])
  }

  const row = (todo) => (
    <TodoRow
      key={todo.id}
      todo={todo}
      onUpdate={(changes, persist) => update(todo.id, changes, persist)}
      onCommit={() => onPersist('todos')}
      onRemove={() => remove(todo.id)}
    />
  )

  return (
    <section className="todo-panel" aria-labelledby="todo-heading">
      <div className="section-header">
        <h2 id="todo-heading">To-do</h2>
        <span className="section-count">{open.length} open</span>
      </div>
      <form className="todo-add" onSubmit={add}>
        <Plus className="ui-icon" aria-hidden="true" />
        <input type="text" value={draft} maxLength={500} placeholder="Add a task" aria-label="Add a task" onChange={(event) => setDraft(event.target.value)} />
      </form>
      {open.length > 0 && <ul className="todo-list">{open.map(row)}</ul>}
      {open.length === 0 && done.length === 0 && <p className="section-empty">Nothing to do yet.</p>}
      {done.length > 0 && (
        <>
          <button type="button" className="todo-completed-toggle" aria-expanded={completedOpen} onClick={() => setCompletedOpen(!completedOpen)}>
            {completedOpen ? <NavArrowDown className="ui-icon" aria-hidden="true" /> : <NavArrowRight className="ui-icon" aria-hidden="true" />}
            Completed · {done.length}
          </button>
          {completedOpen && <ul className="todo-list">{done.map(row)}</ul>}
        </>
      )}
    </section>
  )
}
