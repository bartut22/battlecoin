import { createWallet } from './solana.js'

const SESSION_KEY = 'battlecoin_session'

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) }
  catch { return null }
}

async function request(path, body) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    return { error: 'Cannot reach the server. Is the backend running?' }
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { error: data.detail || 'Something went wrong.' }
  return data
}

export async function signup(username, password) {
  username = username.trim()
  if (!username || !password) return { error: 'Enter a username and password.' }
  const wallet = createWallet()
  const result = await request('/signup', { username, password, ...wallet })
  if (result.error) return result
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username: result.username, userId: result.id, wallet: result.wallet }))
  return { username: result.username, userId: result.id, wallet: result.wallet, isNew: true }
}

export async function login(username, password) {
  username = username.trim()
  const result = await request('/login', { username, password })
  if (result.error) return result
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username: result.username, userId: result.id, wallet: result.wallet }))
  return { username: result.username, userId: result.id, wallet: result.wallet }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}
