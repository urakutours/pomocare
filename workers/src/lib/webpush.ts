/**
 * Web Push implementation using Web Crypto API (Cloudflare Workers compatible).
 * Replaces the `web-push` npm package which requires Node.js crypto.
 *
 * Implements RFC 8291 (Message Encryption for Web Push) and
 * RFC 8292 (VAPID for Web Push).
 */

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface VapidDetails {
  subject: string;
  publicKey: string;
  privateKey: string;
}

// ---- Base64url helpers ----

function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64url(arr: Uint8Array): string {
  let binary = '';
  for (const byte of arr) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---- Crypto helpers ----

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  return new Uint8Array(sig as ArrayBuffer);
}

async function hkdfSha256(
  ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number,
): Promise<Uint8Array> {
  // Extract
  const prk = await hmacSha256(salt.length > 0 ? salt : new Uint8Array(32), ikm);
  // Expand
  let t: Uint8Array = new Uint8Array(0);
  let okm: Uint8Array = new Uint8Array(0);
  for (let i = 1; okm.length < length; i++) {
    t = await hmacSha256(prk, concatUint8Arrays(t, info, new Uint8Array([i])));
    okm = concatUint8Arrays(okm, t);
  }
  return okm.slice(0, length);
}

function createInfo(
  type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array,
): Uint8Array {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(type);
  // "Content-Encoding: <type>\0" + "P-256\0" + client key length + client key + server key length + server key
  const header = encoder.encode('Content-Encoding: ');
  const nul = new Uint8Array([0]);
  const p256 = encoder.encode('P-256');
  const clientLen = new Uint8Array(2);
  clientLen[0] = 0; clientLen[1] = clientPublicKey.length;
  const serverLen = new Uint8Array(2);
  serverLen[0] = 0; serverLen[1] = serverPublicKey.length;

  return concatUint8Arrays(
    header, typeBytes, nul, p256, nul,
    clientLen, clientPublicKey,
    serverLen, serverPublicKey,
  );
}

// ---- VAPID JWT ----

async function createVapidJWT(
  audience: string, vapid: VapidDetails,
): Promise<{ authorization: string; cryptoKey: string }> {
  const now = Math.floor(Date.now() / 1000);
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = { aud: audience, exp: now + 12 * 3600, sub: vapid.subject };

  const headerB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import VAPID private key (base64url-encoded raw 32 bytes)
  const privateKeyBytes = base64urlToUint8Array(vapid.privateKey);
  const publicKeyBytes = base64urlToUint8Array(vapid.publicKey);

  // Build JWK from raw key
  const jwk = {
    kty: 'EC',
    crv: 'P-256',
    x: uint8ArrayToBase64url(publicKeyBytes.slice(1, 33)),
    y: uint8ArrayToBase64url(publicKeyBytes.slice(33, 65)),
    d: uint8ArrayToBase64url(privateKeyBytes),
  };

  const key = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key,
    new TextEncoder().encode(unsignedToken),
  );

  // Convert DER signature to raw r||s format
  const sigBytes = new Uint8Array(signature);
  const token = `${unsignedToken}.${uint8ArrayToBase64url(sigBytes)}`;

  return {
    authorization: `vapid t=${token}, k=${vapid.publicKey}`,
    cryptoKey: vapid.publicKey,
  };
}

// ---- Encrypt payload (RFC 8291 / aes128gcm) ----

async function encryptPayload(
  clientPublicKeyB64: string,
  clientAuthB64: string,
  payload: string,
  localPublicKey: Uint8Array,
  sharedSecret: Uint8Array,
): Promise<Uint8Array> {
  const clientPublicKey = base64urlToUint8Array(clientPublicKeyB64);
  const clientAuth = base64urlToUint8Array(clientAuthB64);
  const payloadBytes = new TextEncoder().encode(payload);

  const salt = crypto.getRandomValues(new Uint8Array(16));

  // IKM = HKDF(auth_secret, ecdh_secret, "WebPush: info\0" || ua_public || as_public)
  const authInfo = concatUint8Arrays(
    new TextEncoder().encode('WebPush: info\0'),
    clientPublicKey,
    localPublicKey,
  );
  const ikm = await hkdfSha256(sharedSecret, clientAuth, authInfo, 32);

  // CEK and nonce
  const cekInfo = createInfo('aes128gcm', clientPublicKey, localPublicKey);
  const nonceInfo = createInfo('nonce', clientPublicKey, localPublicKey);
  const cek = await hkdfSha256(ikm, salt, cekInfo, 16);
  const nonce = await hkdfSha256(ikm, salt, nonceInfo, 12);

  // Pad payload (add 0x02 delimiter + zero padding)
  const paddedPayload = concatUint8Arrays(payloadBytes, new Uint8Array([2]));

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw', cek, { name: 'AES-GCM' }, false, ['encrypt'],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce }, aesKey, paddedPayload,
  );
  const encryptedBytes = new Uint8Array(encrypted);

  // Build aes128gcm content-coding header:
  // salt (16) || rs (4) || idlen (1) || keyid (65) || encrypted
  const rs = new Uint8Array(4);
  const recordSize = paddedPayload.length + 16 + 1; // ciphertext + tag + padding delimiter
  new DataView(rs.buffer).setUint32(0, recordSize > 4096 ? 4096 : recordSize);
  const idlen = new Uint8Array([65]); // uncompressed public key is 65 bytes

  return concatUint8Arrays(salt, rs, idlen, localPublicKey, encryptedBytes);
}

// ---- Public API ----

export async function sendNotification(
  subscription: PushSubscription,
  payload: string,
  vapid: VapidDetails,
): Promise<{ statusCode: number }> {
  // Generate ephemeral ECDH key pair
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  ) as CryptoKeyPair;

  // Export local public key (uncompressed)
  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', keyPair.publicKey) as ArrayBuffer,
  );

  // Import subscriber's public key
  const clientPublicKeyBytes = base64urlToUint8Array(subscription.keys.p256dh);
  const clientPublicKey = await crypto.subtle.importKey(
    'raw', clientPublicKeyBytes, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );

  // ECDH shared secret
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientPublicKey } as unknown as SubtleCryptoDeriveKeyAlgorithm, keyPair.privateKey, 256,
  );
  const sharedSecret = new Uint8Array(sharedSecretBits);

  // Encrypt payload
  const body = await encryptPayload(
    subscription.keys.p256dh,
    subscription.keys.auth,
    payload,
    localPublicKeyRaw,
    sharedSecret,
  );

  // VAPID auth
  const endpoint = new URL(subscription.endpoint);
  const audience = `${endpoint.protocol}//${endpoint.host}`;
  const vapidHeaders = await createVapidJWT(audience, vapid);

  // Send to push service
  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'Content-Length': body.length.toString(),
      TTL: '86400',
      Authorization: vapidHeaders.authorization,
    },
    body,
  });

  return { statusCode: response.status };
}
