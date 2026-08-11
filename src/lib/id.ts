/**
 * Generates short, URL-friendly IDs.
 * Format: 8 alphanumeric characters (e.g., "k7x9m2pq")
 * ~2.8 trillion combinations — safe for production scale.
 */

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 8;

export function generateId(): string {
  let id = "";
  const bytes = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return id;
}

/**
 * Generates a prefixed ID for readability.
 * e.g., generatePrefixedId("cust") → "cust_k7x9m2pq"
 */
export function generatePrefixedId(prefix: string): string {
  return `${prefix}_${generateId()}`;
}
