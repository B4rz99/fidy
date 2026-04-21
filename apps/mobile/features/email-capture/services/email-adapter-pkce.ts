import { CryptoDigestAlgorithm, digest, getRandomBytes } from "expo-crypto";

function base64UrlEncode(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function generatePkce(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const codeVerifier = base64UrlEncode(getRandomBytes(48));
  const verifierBytes = new TextEncoder().encode(codeVerifier);
  const challengeHash = await digest(CryptoDigestAlgorithm.SHA256, verifierBytes);
  const codeChallenge = base64UrlEncode(new Uint8Array(challengeHash));
  return { codeVerifier, codeChallenge };
}
