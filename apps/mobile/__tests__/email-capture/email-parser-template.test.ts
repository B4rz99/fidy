import { describe, expect, it } from "vitest";
import {
  buildEmailParserTemplate,
  normalizeEmailParserText,
} from "@/features/email-capture/services/email-parser-template";

describe("email parser templates", () => {
  it("normalizes provider text noise before parser matching", () => {
    expect(normalizeEmailParserText(" Compra&nbsp;aprobada\n\n\tpor   $50.000 ")).toBe(
      "Compra aprobada por $50.000"
    );
  });

  it("keeps bank email structure while removing sensitive values", () => {
    const template = buildEmailParserTemplate(
      "Compra aprobada en EXITO COLOMBIA por $50.000 el 18/05/2026 con tarjeta **** 1234. Cuenta 12345678901."
    );

    expect(template).toBe(
      "Compra aprobada en [MERCHANT] por [AMOUNT] el [DATE] con tarjeta [CARD]. [ACCOUNT]."
    );
    expect(template).not.toMatch(/EXITO|50\.000|18\/05\/2026|1234|12345678901/u);
  });

  it("redacts merchant names when the amount follows the merchant", () => {
    const template = buildEmailParserTemplate("Compra EXITO COLOMBIA por $50.000 aprobada");

    expect(template).toBe("Compra [MERCHANT] por [AMOUNT] aprobada");
    expect(template).not.toMatch(/EXITO|COLOMBIA|50\.000/u);
  });
});
