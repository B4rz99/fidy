import { describe, expect, it } from "vitest";
import {
  getTemplateShapePrivacyFailure,
  isAllowedStructuralLowercaseWord,
  isAllowedStructuralTitleWord,
  type TemplateShapePrivacyFailureReason,
} from "@/features/capture-sources/lib/capture-improvement-template-shape-policy";
import { getTemplateShapePrivacyFailure as getRemoteTemplateShapePrivacyFailure } from "../../../../supabase/functions/cloud-ledger-api/capture-improvement-template-shape-policy";

const unsafeCases: readonly {
  readonly expected: TemplateShapePrivacyFailureReason;
  readonly template: string;
}[] = [
  {
    expected: "sensitive_value_pattern",
    template: "Compra por 50000 en [MERCHANT].",
  },
  {
    expected: "sensitive_value_pattern",
    template: "ABC123XYZ Compra por [AMOUNT] en [MERCHANT].",
  },
  {
    expected: "sensitive_value_pattern",
    template: "Ref A123B por [AMOUNT].",
  },
  {
    expected: "sensitive_value_pattern",
    template: "Ref No. A123B por [AMOUNT].",
  },
  {
    expected: "sensitive_value_pattern",
    template: "Autorizacion A1B2C por [AMOUNT].",
  },
  {
    expected: "sensitive_value_pattern",
    template: "Autorizacion No. A1B2C por [AMOUNT].",
  },
  {
    expected: "lowercase_counterparty_pattern",
    template: "juan perez te envio [AMOUNT].",
  },
  {
    expected: "lowercase_context_entity_pattern",
    template: "Comercio: exito por [AMOUNT].",
  },
  {
    expected: "lowercase_unlabeled_counterparty_pattern",
    template: "exito compra por [AMOUNT].",
  },
  {
    expected: "residual_lowercase_entity",
    template: "rappi retiro por [AMOUNT].",
  },
  {
    expected: "residual_entity_pattern",
    template: "Compra EXITO por [AMOUNT].",
  },
  {
    expected: "residual_title_entity",
    template: "Compra Exito por [AMOUNT].",
  },
];

describe("Capture Improvement Template Shape privacy policy", () => {
  it("accepts structural Template Shapes", () => {
    const template = "Compra por [AMOUNT] en [MERCHANT] con tarjeta [CARD].";

    expect(getTemplateShapePrivacyFailure(template)).toBeNull();
    expect(getRemoteTemplateShapePrivacyFailure(template)).toBeNull();
  });

  it.each(unsafeCases)("classifies unsafe Template Shapes: $expected", ({ expected, template }) => {
    expect(getTemplateShapePrivacyFailure(template)).toBe(expected);
    expect(getRemoteTemplateShapePrivacyFailure(template)).toBe(expected);
  });

  it("shares structural word decisions with mobile redaction", () => {
    expect(isAllowedStructuralTitleWord("Compra")).toBe(true);
    expect(isAllowedStructuralLowercaseWord("compra")).toBe(true);
    expect(isAllowedStructuralTitleWord("Exito")).toBe(false);
    expect(isAllowedStructuralLowercaseWord("exito")).toBe(false);
  });
});
