import { stripPii } from "../parsing.public";

type RedactionRule = {
  readonly pattern: RegExp;
  readonly replacement: string;
};

const DATE_RULES: readonly RedactionRule[] = [
  {
    pattern: /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g,
    replacement: "[DATE]",
  },
];

const AMOUNT_RULES: readonly RedactionRule[] = [
  { pattern: /\$\s*\d(?:[\d.,]*\d)?/g, replacement: "[AMOUNT]" },
  { pattern: /\bCOP\s*\d(?:[\d.,]*\d)?/gi, replacement: "[AMOUNT]" },
];

const ACCOUNT_RULES: readonly RedactionRule[] = [
  {
    pattern: /\b(?:cuenta|account)\s+\d{6,}\b/gi,
    replacement: "[ACCOUNT]",
  },
];

const CARD_RULES: readonly RedactionRule[] = [
  {
    pattern: /\b(?:tarjeta|card)\s+(?:[*xX]+\s*)?\d{4}\b/gi,
    replacement: "tarjeta [CARD]",
  },
];

const COUNTERPARTY_RULES: readonly RedactionRule[] = [
  {
    pattern: /(\ben\s+)(.+?)(?=\s+(?:por|el|con|tarjeta|cuenta|card)\b|[.;]|$)/gi,
    replacement: "$1[MERCHANT]",
  },
  {
    pattern: /(\bat\s+)(.+?)(?=\s+(?:for|on|with|card|account)\b|[.;]|$)/gi,
    replacement: "$1[MERCHANT]",
  },
  {
    pattern:
      /(\b(?:comercio|establecimiento)\s*:?\s*)(.+?)(?=\s+(?:por|el|con|tarjeta|cuenta|card)\b|[.;]|$)/gi,
    replacement: "$1[MERCHANT]",
  },
  {
    pattern:
      /(\b(?:compra|purchase|pago|payment)\s+)(?!por\b|of\b|for\b|aprobada\b|aprobado\b|realizada\b|exitos[ao]\b)(.+?)(?=\s+(?:por|of|for|el|con|with|tarjeta|cuenta|card)\b|[.;]|$)/gi,
    replacement: "$1[MERCHANT]",
  },
  {
    pattern:
      /(\b(?:beneficiario|destinatario|para|de|a)\s+)(.+?)(?=\s+(?:por|el|con|tarjeta|cuenta|card)\b|[.;]|$)/gi,
    replacement: "$1[COUNTERPARTY]",
  },
];

const applyRedactionRule = (text: string, rule: RedactionRule): string =>
  text.replace(rule.pattern, rule.replacement);

const normalizeTemplateWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

export const normalizeEmailParserText = (rawText: string): string =>
  normalizeTemplateWhitespace(
    rawText
      .normalize("NFC")
      .replace(/&nbsp;/gi, " ")
      .replace(/\u00a0/g, " ")
      .replace(/[\u200b-\u200d\ufeff]/g, "")
  );

export const buildEmailParserTemplate = (rawText: string): string =>
  normalizeTemplateWhitespace(
    COUNTERPARTY_RULES.reduce(
      applyRedactionRule,
      CARD_RULES.reduce(
        applyRedactionRule,
        ACCOUNT_RULES.reduce(
          applyRedactionRule,
          AMOUNT_RULES.reduce(
            applyRedactionRule,
            DATE_RULES.reduce(applyRedactionRule, stripPii(normalizeEmailParserText(rawText)))
          )
        )
      )
    )
  );
