export const HERMES_AGENTS = [
  { name: 'Hermes Scout', model: 'gpt-5.6-luna', reasoning: 'low', maxComplexity: 3 },
  { name: 'Hermes Builder', model: 'gpt-5.6-luna', reasoning: 'medium', maxComplexity: 4 },
  { name: 'Hermes Director', model: 'gpt-5.6-terra', reasoning: 'xhigh', maxComplexity: Infinity },
]

export function taskComplexity(value, spreadCents = 7) {
  const notional = Number(value) || 0
  const sizeScore = notional >= 5000 ? 5 : notional >= 2000 ? 3 : notional >= 750 ? 2 : 1
  const spreadScore = spreadCents >= 7 ? 2 : spreadCents >= 4 ? 1 : 0
  return sizeScore + spreadScore
}

export function delegateBattleTasks(cards, takers, market) {
  const jobs = [
    ...cards.map((card) => ({ label: card.name, kind: 'deck', notional: card.notional })),
    ...takers.up.map((notional, index) => ({ label: `UP taker ${index + 1}`, kind: 'up-taker', notional })),
    ...takers.down.map((notional, index) => ({ label: `DOWN taker ${index + 1}`, kind: 'down-taker', notional })),
  ]

  return jobs
    .map((job) => {
      const complexity = taskComplexity(job.notional, market.spreadCents)
      const agent = HERMES_AGENTS.find((candidate) => complexity <= candidate.maxComplexity) || HERMES_AGENTS.at(-1)
      return { ...job, complexity, agent }
    })
    .sort((a, b) => b.complexity - a.complexity || b.notional - a.notional)
}
