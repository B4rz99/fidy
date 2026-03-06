import { CATEGORY_IDS } from "@/features/transactions/lib/categories";

export function buildExtractionPrompt(emailBody: string): string {
  return `Extrae la transaccion de este correo bancario como JSON.
Responde SOLO con el JSON, sin explicacion.

Formato:
{"type":"expense"|"income","amountCents":number,"categoryId":"...","description":"...","date":"YYYY-MM-DD","confidence":number}

Categorias: ${CATEGORY_IDS.join(", ")}

amountCents debe ser el monto en centavos (ej: $50,000 COP = 5000000).
confidence es un numero entre 0 y 1 indicando tu certeza.

Correo:
${emailBody}`;
}
