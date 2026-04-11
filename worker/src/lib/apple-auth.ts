/**
 * Apple Sign In helpers for Cloudflare Workers.
 *
 * Apple OAuth differs from Google:
 *   - Callback is POST with application/x-www-form-urlencoded body
 *   - Returns a JWT id_token directly (no token exchange step)
 *   - User's name is only sent on the FIRST authorization
 *   - "Hide My Email" generates @privaterelay.appleid.com addresses
 *   - Client secret is a short-lived JWT signed with an ES256 key
 */

interface AppleJWK {
  kty: string
  kid: string
  use: string
  alg: string
  n: string
  e: string
}

interface AppleJWKS {
  keys: AppleJWK[]
}

interface AppleIdTokenPayload {
  iss: string
  aud: string
  exp: number
  iat: number
  sub: string           // Apple's unique user ID (stable across logins)
  email?: string
  email_verified?: string | boolean
  is_private_email?: string | boolean
  nonce?: string
}

/**
 * Generate a client secret JWT for Apple Sign In.
 * Apple requires a short-lived ES256 JWT instead of a static client secret.
 */
export async function generateAppleClientSecret(
  teamId: string,
  serviceId: string,
  keyId: string,
  privateKeyPem: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT',
  }

  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 15777000, // ~6 months (Apple's max)
    aud: 'https://appleid.apple.com',
    sub: serviceId,
  }

  const key = await importPKCS8(privateKeyPem)

  const headerB64 = base64url(JSON.stringify(header))
  const payloadB64 = base64url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  )

  // Convert DER signature to raw r||s format for JWT
  const sigBytes = new Uint8Array(signature)
  const rawSig = derToRaw(sigBytes)
  const signatureB64 = base64url(rawSig)

  return `${signingInput}.${signatureB64}`
}

/**
 * Verify an Apple id_token JWT against Apple's JWKS endpoint.
 * Returns the decoded payload if valid.
 */
export async function verifyAppleIdToken(
  idToken: string,
  expectedAudience: string,
): Promise<AppleIdTokenPayload> {
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('Invalid JWT format')

  const headerJson = JSON.parse(atob(parts[0]!.replace(/-/g, '+').replace(/_/g, '/')))
  const kid = headerJson.kid as string
  if (!kid) throw new Error('Missing kid in JWT header')

  // Fetch Apple's JWKS
  const jwksRes = await fetch('https://appleid.apple.com/auth/keys')
  if (!jwksRes.ok) throw new Error('Failed to fetch Apple JWKS')
  const jwks = await jwksRes.json() as AppleJWKS

  const jwk = jwks.keys.find(k => k.kid === kid)
  if (!jwk) throw new Error(`No matching key found for kid: ${kid}`)

  // Import the public key
  const publicKey = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  // Verify signature
  const signatureBytes = base64urlDecode(parts[2]!)
  const dataBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    signatureBytes,
    dataBytes,
  )

  if (!valid) throw new Error('Invalid JWT signature')

  // Decode and validate payload
  const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as AppleIdTokenPayload

  if (payload.iss !== 'https://appleid.apple.com') {
    throw new Error('Invalid issuer')
  }
  if (payload.aud !== expectedAudience) {
    throw new Error(`Invalid audience: expected ${expectedAudience}, got ${payload.aud}`)
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired')
  }

  return payload
}

// --- Utility functions ---

function base64url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  const binString = Array.from(bytes, b => String.fromCharCode(b)).join('')
  return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlDecode(input: string): Uint8Array {
  const padded = input + '='.repeat((4 - input.length % 4) % 4)
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(binary, c => c.charCodeAt(0))
}

async function importPKCS8(pem: string): Promise<CryptoKey> {
  // Strip PEM headers/footers and whitespace
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')

  const binary = atob(pemContents)
  const der = Uint8Array.from(binary, c => c.charCodeAt(0))

  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

/**
 * Convert a DER-encoded ECDSA signature to raw r||s format (64 bytes for P-256).
 * crypto.subtle.sign returns DER format; JWT needs raw.
 */
function derToRaw(der: Uint8Array): Uint8Array {
  // DER: 0x30 <total_len> 0x02 <r_len> <r_bytes> 0x02 <s_len> <s_bytes>
  const raw = new Uint8Array(64)

  let offset = 2 // skip 0x30 and total length
  // R
  const rLen = der[offset + 1]!
  offset += 2
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset
  const rDest = rLen < 32 ? 32 - rLen : 0
  raw.set(der.slice(rStart, offset + rLen), rDest)
  offset += rLen

  // S
  const sLen = der[offset + 1]!
  offset += 2
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset
  const sDest = sLen < 32 ? 64 - sLen : 32
  raw.set(der.slice(sStart, offset + sLen), sDest)

  return raw
}
