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
  assert.deepEqual(searchProjects(projects, '反应时').results.map((result) => result.id), ['beta'])
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
  assert.equal(total, 1)
  assert.deepEqual(results, [])
  assert.deepEqual(searchProjects(projects, ' ').results, [])
})
