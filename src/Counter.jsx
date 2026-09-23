export default function Counter({ label, count, onIncrement }) {
  return (
    <button type="button" className="counter" onClick={onIncrement}>
      {label}: {count}
    </button>
  )
}