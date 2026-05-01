import { z } from "zod";

export const captureEvidenceTypeSchema = z.enum([
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
]);
export type CaptureEvidenceType = z.infer<typeof captureEvidenceTypeSchema>;

export type CaptureEvidenceSeed = {
  readonly sourceFamily: string;
  readonly evidenceType: CaptureEvidenceType;
  readonly scope: string;
  readonly value: string;
};
