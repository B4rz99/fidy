import { describe, expect, it } from "vitest";
import { htmlToPlainText } from "@/shared/lib/html-to-text";

describe("htmlToPlainText", () => {
  it("preserves undecoded entities instead of deleting their text", () => {
    expect(htmlToPlainText("<p>Pago &ndash; aprobado &copy;</p>")).toBe(
      "Pago &ndash; aprobado &copy;"
    );
  });
});
