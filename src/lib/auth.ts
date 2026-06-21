const SECRET_KEY_STR = process.env.SESSION_SECRET || "kdashm-poc-secret-key-982173921";

// Helper to get crypto key for HMAC
async function getCryptoKey() {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SECRET_KEY_STR);
  return crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

// Helper to convert ArrayBuffer to hex string
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface SessionPayload {
  email: string;
  role: string;
  expires: number;
}

// Base64url helper for Web APIs (Edge Runtime safe)
function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binString = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binString += String.fromCharCode(bytes[i]);
  }
  return btoa(binString)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): string {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  const binString = atob(base64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// Generate signed session token carrying email and role
export async function createSessionToken(email: string, role: string): Promise<string> {
  const expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  const payload: SessionPayload = { email, role, expires };
  const payloadStr = base64urlEncode(JSON.stringify(payload));
  
  const key = await getCryptoKey();
  const encoder = new TextEncoder();
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payloadStr)
  );
  
  const signature = bufferToHex(signatureBuffer);
  return `${payloadStr}.${signature}`;
}

// Verify signed session token and return the payload if valid
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    
    const [payloadStr, signature] = parts;
    const key = await getCryptoKey();
    const encoder = new TextEncoder();
    
    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      new Uint8Array(
        signature.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      ),
      encoder.encode(payloadStr)
    );
    
    if (!verified) return null;
    
    const decodedPayloadStr = base64urlDecode(payloadStr);
    const payload = JSON.parse(decodedPayloadStr) as SessionPayload;
    
    if (payload.expires < Date.now()) {
      return null; // Expired
    }
    
    return payload;
  } catch (error) {
    console.error("Token verification failed:", error);
    return null;
  }
}
