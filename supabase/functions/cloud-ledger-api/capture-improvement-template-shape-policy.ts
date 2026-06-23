export type TemplateShapePrivacyFailureReason =
  | "lowercase_context_entity_pattern"
  | "lowercase_counterparty_pattern"
  | "lowercase_unlabeled_counterparty_pattern"
  | "residual_entity_pattern"
  | "residual_lowercase_entity"
  | "residual_title_entity"
  | "sensitive_value_pattern"
  | "unredacted_location";

type TemplateShapePrivacyCheck = {
  readonly reason: TemplateShapePrivacyFailureReason;
  readonly isUnsafe: (template: string) => boolean;
};

const SENSITIVE_TEMPLATE_PATTERNS = [
  String.raw`[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}`,
  String.raw`\+\d[\d\s-]{8,14}\d`,
  String.raw`(?<!\d)3\d{2}[\s-]?\d{3}[\s-]?\d{4}\b`,
  String.raw`\b(?:ref(?:erencia)?|autori[sz]aci[oó]n|authorization)\b\s*:?\s*#?\s*(?=[A-Z0-9-]*[A-Z])(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,}\b`,
  String.raw`\b(?:C\.?\s?C\.?|T\.?\s?I\.?|C\.?\s?E\.?|[Cc][eé]dula)\s*:?\s*#?\s*\d{6,11}\b`,
  String.raw`\bNIT\s*:?\s*\d{3}\.?\d{3}\.?\d{3,4}-?\d?\b`,
  String.raw`\b\d{9,10}-\d\b`,
  String.raw`\b\d{3}\.\d{3}\.\d{3,4}-?\d?\b`,
  String.raw`(?:(?:No\.?\s*)?Cuenta|Cta\.?)\s*(?:(?:de\s+)?(?:Ahorros|Corriente)\s*)?(?:No\.?\s*)?#?\s{0,3}\d{8,20}`,
  String.raw`\b\d{11,14}\b`,
  String.raw`\b\d{4}\s+\d{4}\s+\d{3,6}\b`,
  String.raw`(?<!\d)\(?60[1-8]\)?[\s-]?\d{3}[\s-]?\d{4}\b`,
  String.raw`\btarjeta\s+(?:terminada|finalizada)\s+en\s+\d{4}\b`,
  String.raw`\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b`,
  String.raw`\b\d{15,16}\b`,
  String.raw`\d{4}[\s-]*[*Xx]{2,}[\s-]*[*Xx]{2,}[\s-]*\d{4}`,
  String.raw`[*Xx]{2,4}[\s.-]*[*Xx]{2,4}[\s.-]*[*Xx]{2,4}[\s.-]*\d{4}`,
  String.raw`(?<![A-Za-z0-9])(?:\*{1,4}|[Xx]{2,4})[\s.-]*\d{4}\b`,
  String.raw`\b\d+\b`,
].map((pattern) => new RegExp(pattern, "i"));
const LOWERCASE_COUNTERPARTY_PATTERN =
  /\b[a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)+\s*:?\s+te\s+(?:envio|envió|transfirio|transfirió)\b/i;
const LOWERCASE_CONTEXT_ENTITY_PATTERN =
  /\b(?:a|at|beneficiario|cerca de|comercio|de|destinatario|en|establecimiento|para)\b\s*:?\s+(?!\[)[a-záéíóúñ]{3,}(?:\s+(?!\[)[a-záéíóúñ]{2,})*/i;
const LOWERCASE_UNLABELED_COUNTERPARTY_PATTERN =
  /(?:^|[.;:]\s*)[a-záéíóúñ]{3,}(?:\s+[a-záéíóúñ]{2,}){0,3}\s+(?:compra|pago|purchase|payment)\b/;
const UNREDACTED_LOCATION_PATTERN =
  /\b(?:bogot[aá]|medell[ií]n|cali|barranquilla|cartagena|colombia)\b/i;
const RESIDUAL_ENTITY_PATTERN = /(?<!\[)\b[A-ZÁÉÍÓÚÑ]{3,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,})*\b(?!\])/;
const STRUCTURAL_TITLE_WORDS = new Set([
  "Abono",
  "Autorizacion",
  "Autorización",
  "Authorization",
  "Beneficiario",
  "Cel",
  "Compra",
  "Comercio",
  "Consignacion",
  "Consignación",
  "Deposito",
  "Depósito",
  "Destinatario",
  "Establecimiento",
  "Pago",
  "Recibiste",
  "Ref",
  "Referencia",
  "Tarjeta",
  "Tel",
  "Transferencia",
]);
const STRUCTURAL_LOWERCASE_WORDS = new Set([
  "abono",
  "account",
  "autorizacion",
  "autorización",
  "authorization",
  "beneficiario",
  "card",
  "cel",
  "cerca",
  "comercio",
  "compra",
  "con",
  "consignacion",
  "consignación",
  "cuenta",
  "de",
  "deposito",
  "depósito",
  "desde",
  "destinatario",
  "el",
  "en",
  "envio",
  "envió",
  "establecimiento",
  "for",
  "from",
  "informa",
  "near",
  "nuevo",
  "pago",
  "para",
  "payment",
  "por",
  "purchase",
  "recibiste",
  "ref",
  "referencia",
  "retiro",
  "tarjeta",
  "tel",
  "the",
  "transferencia",
  "transfirio",
  "transfirió",
  "with",
]);
const RESIDUAL_TITLE_TOKEN = /(?<!\[)\b[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}\b(?!\])/g;
const RESIDUAL_LOWERCASE_TOKEN = /(?<!\[)\b[a-záéíóúñ]{3,}\b(?!\])/g;

const isAllowedStructuralTitleWord = (word: string): boolean => STRUCTURAL_TITLE_WORDS.has(word);

const isAllowedStructuralLowercaseWord = (word: string): boolean =>
  STRUCTURAL_LOWERCASE_WORDS.has(word);

const hasResidualTitleEntity = (template: string): boolean =>
  Array.from(template.matchAll(RESIDUAL_TITLE_TOKEN)).some(
    ([word]) => typeof word === "string" && !isAllowedStructuralTitleWord(word)
  );

const hasResidualLowercaseEntity = (template: string): boolean =>
  Array.from(template.matchAll(RESIDUAL_LOWERCASE_TOKEN)).some(
    ([word]) => typeof word === "string" && !isAllowedStructuralLowercaseWord(word)
  );

const TEMPLATE_PRIVACY_CHECKS: readonly TemplateShapePrivacyCheck[] = [
  {
    reason: "sensitive_value_pattern",
    isUnsafe: (template) => SENSITIVE_TEMPLATE_PATTERNS.some((pattern) => pattern.test(template)),
  },
  {
    reason: "lowercase_counterparty_pattern",
    isUnsafe: (template) => LOWERCASE_COUNTERPARTY_PATTERN.test(template),
  },
  {
    reason: "lowercase_context_entity_pattern",
    isUnsafe: (template) => LOWERCASE_CONTEXT_ENTITY_PATTERN.test(template),
  },
  {
    reason: "lowercase_unlabeled_counterparty_pattern",
    isUnsafe: (template) => LOWERCASE_UNLABELED_COUNTERPARTY_PATTERN.test(template),
  },
  {
    reason: "residual_lowercase_entity",
    isUnsafe: hasResidualLowercaseEntity,
  },
  {
    reason: "unredacted_location",
    isUnsafe: (template) => UNREDACTED_LOCATION_PATTERN.test(template),
  },
  {
    reason: "residual_entity_pattern",
    isUnsafe: (template) => RESIDUAL_ENTITY_PATTERN.test(template),
  },
  {
    reason: "residual_title_entity",
    isUnsafe: hasResidualTitleEntity,
  },
];

export function getTemplateShapePrivacyFailure(
  template: string
): TemplateShapePrivacyFailureReason | null {
  return TEMPLATE_PRIVACY_CHECKS.find((check) => check.isUnsafe(template))?.reason ?? null;
}
