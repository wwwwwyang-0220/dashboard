// Board cards live on a grid of 24 proportional columns and fixed 24px rows.
export const COLUMNS = 24
export const ROW = 24
export const GAP = 16
export const MIN_W = 3
export const MIN_H = 4
export const MAX_H = 80

export function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

export function fits(rect, cards, ignoreId) {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= COLUMNS
    && rect.w >= MIN_W && rect.h >= MIN_H && rect.h <= MAX_H
    && !cards.some((card) => card.itemId !== ignoreId && overlaps(rect, card))
}

export function bottomRow(cards) {
  return cards.reduce((bottom, card) => Math.max(bottom, card.y + card.h), 0)
}

// The free position closest to `target`, scanning every row down to just past the last card.
export function nearestFreeSlot(cards, target, ignoreId) {
  const size = { w: Math.min(target.w, COLUMNS), h: target.h }
  let best = null
  const lastRow = bottomRow(cards) + 1
  for (let y = 0; y <= Math.max(lastRow, target.y); y++) {
    for (let x = 0; x + size.w <= COLUMNS; x++) {
      const rect = { x, y, ...size }
      if (!fits(rect, cards, ignoreId)) continue
      const distance = Math.abs(x - target.x) * 2 + Math.abs(y - target.y)
      if (!best || distance < best.distance) best = { ...rect, distance }
    }
  }
  if (!best) return { x: 0, y: lastRow, ...size }
  const { distance: _distance, ...rect } = best
  return rect
}

// The first free position in reading order: the slot "+ Add" uses.
export function nextFreeSlot(cards, size) {
  for (let y = 0; ; y++) {
    for (let x = 0; x + size.w <= COLUMNS; x++) {
      if (fits({ x, y, ...size }, cards)) return { x, y, ...size }
    }
  }
}

export function defaultSize(item, columnWidth) {
  if (item.type !== 'image' || !item.width || !item.height) return item.type === 'image' ? { w: 12, h: 14 } : { w: 8, h: 10 }
  const w = 12
  const imageHeight = (w * columnWidth - GAP) * (item.height / item.width)
  const h = Math.round((imageHeight + 45 + GAP) / ROW)
  return { w, h: Math.max(MIN_H, Math.min(MAX_H, h)) }
}

// Edges and sizes `rect` shares with the other cards, used to draw alignment guides.
export function alignment(rect, cards, ignoreId) {
  const lines = new Map()
  const sizes = new Set()
  const add = (axis, edge, at, other) => {
    const key = `${axis}-${edge}-${at}`
    const [from, to] = axis === 'x'
      ? [Math.min(rect.y, other.y), Math.max(rect.y + rect.h, other.y + other.h)]
      : [Math.min(rect.x, other.x), Math.max(rect.x + rect.w, other.x + other.w)]
    const current = lines.get(key)
    lines.set(key, { axis, edge, at, from: Math.min(from, current?.from ?? from), to: Math.max(to, current?.to ?? to) })
  }
  for (const card of cards) {
    if (card.itemId === ignoreId) continue
    if (card.x === rect.x) add('x', 'start', rect.x, card)
    if (card.x + card.w === rect.x + rect.w) add('x', 'end', rect.x + rect.w, card)
    if (card.y === rect.y) add('y', 'start', rect.y, card)
    if (card.y + card.h === rect.y + rect.h) add('y', 'end', rect.y + rect.h, card)
    if (card.w === rect.w) sizes.add('width')
    if (card.h === rect.h) sizes.add('height')
  }
  return { lines: [...lines.values()], sizes }
}

// Adds `items` to `cards` in reading order, skipping any already on the board.
export function placeItems(cards, items, columnWidth) {
  const next = [...cards]
  for (const item of items) {
    if (next.some((card) => card.itemId === item.id)) continue
    next.push({ itemId: item.id, ...nextFreeSlot(next, defaultSize(item, columnWidth)) })
  }
  return next
}
