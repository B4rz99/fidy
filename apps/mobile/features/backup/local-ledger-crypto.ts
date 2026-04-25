export async function deriveWrappingKey(
  secret: string,
  salt: Uint8Array,
  options: { readonly keyBytes: number; readonly iterations: number }
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    toPlainBufferSource(encodeUtf8(secret)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toPlainBufferSource(salt),
      iterations: options.iterations,
    },
    keyMaterial,
    options.keyBytes * 8
  );
  return new Uint8Array(bits);
}

export async function encryptAesGcm(
  rawKey: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array
): Promise<Uint8Array> {
  const key = await importAesGcmKey(rawKey, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toPlainBufferSource(nonce) },
    key,
    toPlainBufferSource(plaintext)
  );
  return new Uint8Array(encrypted);
}

export async function decryptAesGcm(
  rawKey: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array
): Promise<Uint8Array> {
  const key = await importAesGcmKey(rawKey, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toPlainBufferSource(nonce) },
    key,
    toPlainBufferSource(ciphertext)
  );
  return new Uint8Array(decrypted);
}

export const getRandomBytes = (length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
};

export const encodeJson = (value: unknown): Uint8Array => {
  return encodeUtf8(JSON.stringify(value));
};

export const decodeUtf8 = (value: Uint8Array): string => {
  return new TextDecoder().decode(value);
};

export const toBase64 = (value: Uint8Array): string => {
  return btoa(Array.from(value, (byte) => String.fromCodePoint(byte)).join(""));
};

export const fromBase64 = (value: string): Uint8Array => {
  return Uint8Array.from(atob(value), (char) => char.codePointAt(0) ?? 0);
};

export const isBase64String = (value: unknown): boolean => {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }

  try {
    return toBase64(fromBase64(value)) === value;
  } catch (_error) {
    return false;
  }
};

export const toHex = (value: Uint8Array): string => {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0").toUpperCase()).join("");
};

function importAesGcmKey(rawKey: Uint8Array, usages: readonly KeyUsage[]): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toPlainBufferSource(rawKey), "AES-GCM", false, [...usages]);
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function toPlainBufferSource(value: Uint8Array): BufferSource {
  const copy = new Uint8Array(new ArrayBuffer(value.byteLength));
  copy.set(value);
  return copy;
}
