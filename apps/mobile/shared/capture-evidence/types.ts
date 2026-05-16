export const CAPTURE_EVIDENCE_TYPES = [
  "sender_email",
  "sender_domain",
  "package_name",
  "alias_token",
  "card_hint",
  "last4",
  "llm_account_hint",
  "card_product_hint",
  "account_type_hint",
  "counterparty_hint",
] as const;

export type CaptureEvidenceType = (typeof CAPTURE_EVIDENCE_TYPES)[number];

export type CaptureEvidenceSeed = {
  readonly sourceFamily: string;
  readonly evidenceType: CaptureEvidenceType;
  readonly scope: string;
  readonly value: string;
};
