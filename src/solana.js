import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'

const DEVNET_URL = 'https://api.devnet.solana.com'
const AIRDROP_SOL = 1

let connection = null
function getConnection() {
  if (!connection) connection = new Connection(DEVNET_URL, 'confirmed')
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

export async function airdrop(wallet) {
  const conn = getConnection()
  const keypair = toKeypair(wallet)
  const signature = await conn.requestAirdrop(keypair.publicKey, AIRDROP_SOL * LAMPORTS_PER_SOL)
  const latest = await conn.getLatestBlockhash()
  await conn.confirmTransaction({ signature, ...latest }, 'confirmed')
  return getBalance(wallet)
}

export async function getBalance(wallet) {
  const conn = getConnection()
  const lamports = await conn.getBalance(new PublicKey(wallet.publicKey), 'confirmed')
  return lamports / LAMPORTS_PER_SOL
}
