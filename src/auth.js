import { createWallet } from './solana.js'

const USERS_KEY = 'battlecoin_users'
const SESSION_KEY = 'battlecoin_session'

function loadUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) ?? {} }
  catch { return {} }
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

export function getSession() {
  return localStorage.getItem(SESSION_KEY)
}

export function getUser(username) {
  return loadUsers()[username] ?? null
}

export function signup(username, password) {
  username = username.trim()
  if (!username || !password) return { error: 'Enter a username and password.' }
  const users = loadUsers()
  if (users[username]) return { error: 'That username is taken.' }
  const wallet = createWallet()
  users[username] = { password, wallet }
  saveUsers(users)
  localStorage.setItem(SESSION_KEY, username)
  return { username, wallet, isNew: true }
}

export function login(username, password) {
  username = username.trim()
  const users = loadUsers()
  const record = users[username]
  if (!record || record.password !== password) {
    return { error: 'Wrong username or password.' }
  }
  localStorage.setItem(SESSION_KEY, username)
  return { username, wallet: record.wallet }
}

export function logout() {
  localStorage.removeItem(SESSION_KEY)
}
