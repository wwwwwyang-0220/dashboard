import assert from 'node:assert/strict'
import test from 'node:test'

import { searchProjects } from '../server/search.js'

const projects = [
  {
    id: 'alpha', title: 'Memory Study', description: 'Visual recall',
    items: [
      { id: 'note-1', type: 'note', title: 'Results', content: 'The t distribution has heavier tails than the normal distribution.' },
      { id: 'note-2', type: 'note', title: 'Other note', content: 'A long note about visual recall, recognition, and results.' },
      { id: 'image-1', type: 'image', title: 'Reaction time chart', file: 'chart.png' },
    ],
  },
  { id: 'beta', title: '反应时实验', description: 'Project two', items: [{ id: 'image-2', type: 'image', title: '正态分布图', file: 'normal.png' }] },
]

test('searches projects and library items across projects with useful context', () => {
  const { results, total } = searchProjects(projects, 'reaction time')
  assert.equal(total, 1)
  assert.deepEqual(results[0], {
    id: 'image-1', type: 'image', projectId: 'alpha', projectTitle: 'Memory Study',
    title: 'Reaction time chart', snippet: '', file: 'chart.png',
  })
  assert.deepEqual(searchProjects(projects, '反应时').results.map((result) => result.id), ['beta', 'image-2'])
  assert.deepEqual(searchProjects(projects, '正态').results.map((result) => result.id), ['image-2'])
})

test('finds note content and ranks title matches first', () => {
  const { results } = searchProjects(projects, 'distribution')
  assert.deepEqual(results.map((result) => result.id), ['note-1'])
  assert.match(results[0].snippet, /heavier tails/)
  const ranked = searchProjects(projects, 'results')
  assert.deepEqual(ranked.results.map((result) => result.id), ['note-1', 'note-2'])
  assert.deepEqual(searchProjects(projects, 'visual recall').results.map((result) => result.id), ['note-2'])
})

test('returns bounded results without altering the total', () => {
  const { results, total } = searchProjects(projects, 'study', 0)
  assert.equal(total, 4)
  assert.deepEqual(results, [])
  assert.deepEqual(searchProjects(projects, ' ').results, [])
})

test('finds OCR text in an image and shows the matched line', () => {
  const records = { 'chart.png': { state: 'ready', text: 'Related Probe\nAccuracy\nYA\nControl Strategy' } }
  const matched = searchProjects(projects, 'Related Probe', 60, records)
  assert.equal(matched.results.length, 1)
  assert.equal(matched.results[0].id, 'image-1')
  assert.equal(matched.results[0].snippet, 'Related Probe')
  const combined = searchProjects(projects, 'YA Strategy', 60, records)
  assert.equal(combined.results[0].snippet, 'YA · Control Strategy')
  assert.equal(searchProjects(projects, 'Related Probe').results.length, 0)
})

const figures = [
  {
    id: 'strategy', title: 'Strategy Project',
    items: [
      { id: 'fig-3', type: 'image', title: 'Figure_3', file: 'f3.png' },
      { id: 'fig-4', type: 'image', title: 'Figure_4', file: 'f4.png' },
    ],
  },
  {
    id: 'divided', title: 'Divided attention Project',
    items: [
      { id: 'fig-2', type: 'image', title: 'Figure_2', file: 'f2.png' },
      { id: 'fig-6', type: 'image', title: 'Figure_6', file: 'f6.png' },
    ],
  },
]
const figureText = {
  'f3.png': { state: 'ready', text: 'Intact Probe\nRelated Probe\nUnrelated Probe\nAccuracy\nOA\nYA\nControl Control StrategyStrategy' },
  'f4.png': { state: 'ready', text: 'Strategy effects in each age group\nParameter Posterior Δ [95%]\nStrategy minus Control in YA\nYA minus OA in Control' },
  'f2.png': { state: 'ready', text: 'Experiment 1 - Divided Attention at Retrieval - Accuracy\nIntact Probe (Exp 1)\nFA\nAddition\nDivision' },
  'f6.png': { state: 'ready', text: 'The Effects of Divided Attention at Retrieval on Memory Representations\nPosterior Δ (95%)\nFA - Addition\nFA - Division' },
}
const firstFor = (query) => searchProjects(figures, query, 60, figureText).results[0]?.id

test('ranks the intended figure first for conversational queries using project and OCR text', () => {
  assert.equal(firstFor('the YA and OA bars for Intact Probe in Strategy Project'), 'fig-3')
  assert.equal(firstFor('Strategy project posterior difference forest plot'), 'fig-4')
  assert.equal(firstFor('divided attention project accuracy bars for intact probe'), 'fig-2')
  assert.deepEqual(searchProjects(figures, 'strategy', 60, figureText).results.map((result) => result.id).slice(0, 3).sort(), ['fig-3', 'fig-4', 'strategy'])
})

test('tolerates OCR misreads and punctuation-joined labels', () => {
  assert.equal(firstFor('acuracy intact'), 'fig-3')
  assert.deepEqual(searchProjects(figures, 'FA、Division', 60, figureText).results.map((result) => result.id).sort(), ['fig-2', 'fig-6'])
})

test('keeps the index in step with edits and deletions', () => {
  const edited = structuredClone(figures)
  edited[0].items[0].title = 'Probe accuracy bars'
  edited[1].items = edited[1].items.filter((item) => item.id !== 'fig-2')
  const ids = searchProjects(edited, 'probe accuracy', 60, figureText).results.map((result) => result.id)
  assert.equal(ids[0], 'fig-3')
  assert.ok(!ids.includes('fig-2'))
  assert.equal(searchProjects(figures, 'figure_2', 60, figureText).results[0].id, 'fig-2')
})
