const CARD_NAME_PATTERN = /tarjeta\s+([\p{L}\p{N}\s]+?)(?:\s+en\s|\s+por\s|\s+\*|\.\s|$)/iu;
const LAST_4_STAR_PATTERN = /\*{1,4}(\d{4})/;

export function extractCardIdentifier(text: string): string | null {
  if (text.length === 0) return null;

  // Prefer card name (more specific)
  const nameMatch = text.match(CARD_NAME_PATTERN);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    if (name.length >= 2) return name;
  }

  // Fall back to last 4 digits
  const digitsMatch = text.match(LAST_4_STAR_PATTERN);
  if (digitsMatch) {
    return `*${digitsMatch[1]}`;
  }

  return null;
}
