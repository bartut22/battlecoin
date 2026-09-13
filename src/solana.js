import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'

const DEVNET_URL = 'https://api.devnet.solana.com'
const LOCAL_URL = 'http://127.0.0.1:8899'
// Public devnet's airdrop faucet is rate-limited (2 req/8h); point at a local
// `solana-test-validator` during development to avoid it. Flip back to devnet
// for the real demo by removing VITE_SOLANA_RPC_URL or setting it to DEVNET_URL.
const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || LOCAL_URL

export const NETWORK_LABEL = RPC_URL === DEVNET_URL ? 'Solana devnet' : 'local validator'

// Devnet-only house vault that receives SOL when a player converts it into
// simulated USDT trading capital. Fixed demo rate, not a live price feed.
export const VAULT_ADDRESS = 'DJ6pCmAsCEYe5f3FjHDGS1xy4ofoYdYoBgUH8RMg2Ttv'
export const SOL_USD_RATE = 100

let connection = null
function getConnection() {
  if (!connection) connection = new Connection(RPC_URL, 'confirmed')
  return connection
}

export function createWallet() {
  const keypair = Keypair.generate()
  return {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: Array.from(keypair.secretKey),
  }
}

function toKeypair(wallet) {
  return Keypair.fromSecretKey(Uint8Array.from(wallet.secretKey))
}

export async function airdrop(wallet, amountSol) {
  if (!(amountSol > 0)) throw new Error('Enter an amount greater than 0.')
  const conn = getConnection()
  const keypair = toKeypair(wallet)
  const signature = await conn.requestAirdrop(keypair.publicKey, Math.round(amountSol * LAMPORTS_PER_SOL))
  const latest = await conn.getLatestBlockhash()
  await conn.confirmTransaction({ signature, ...latest }, 'confirmed')
  return getBalance(wallet)
}

async function transferLamports(wallet, destination, lamports) {
  const conn = getConnection()
  const keypair = toKeypair(wallet)
  const transaction = new Transaction().add(SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: destination,
    lamports,
  }))
  const latest = await conn.getLatestBlockhash()
  transaction.recentBlockhash = latest.blockhash
  transaction.feePayer = keypair.publicKey
  transaction.sign(keypair)
  const signature = await conn.sendRawTransaction(transaction.serialize())
  await conn.confirmTransaction({ signature, ...latest }, 'confirmed')
}

export async function withdraw(wallet, toAddress, amountSol) {
  if (!(amountSol > 0)) throw new Error('Enter an amount greater than 0.')
  let destination
  try { destination = new PublicKey(toAddress.trim()) }
  catch { throw new Error('That is not a valid Solana address.') }
  await transferLamports(wallet, destination, Math.round(amountSol * LAMPORTS_PER_SOL))
  return getBalance(wallet)
}

// Moves real SOL out of the player's wallet into the house vault and
// returns how much simulated USDT trading capital that buys, at the fixed
// demo rate. This is a real on-chain transfer, not just a UI number.
export async function convertSolToCapital(wallet, amountSol) {
  if (!(amountSol > 0)) throw new Error('Enter an amount greater than 0.')
  await transferLamports(wallet, new PublicKey(VAULT_ADDRESS), Math.round(amountSol * LAMPORTS_PER_SOL))
  const balance = await getBalance(wallet)
  return { balance, usd: amountSol * SOL_USD_RATE }
}

export async function getBalance(wallet) {
  const conn = getConnection()
  const lamports = await conn.getBalance(new PublicKey(wallet.publicKey), 'confirmed')
  return lamports / LAMPORTS_PER_SOL
}
