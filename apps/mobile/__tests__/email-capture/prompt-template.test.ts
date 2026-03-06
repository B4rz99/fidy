import { describe, expect, it } from "vitest";
import { buildExtractionPrompt } from "../../features/email-capture/lib/prompt-template";

describe("buildExtractionPrompt", () => {
  it("includes the email body in the prompt", () => {
    const prompt = buildExtractionPrompt("Bancolombia: compra $50,000 en Exito");
    expect(prompt).toContain("Bancolombia: compra $50,000 en Exito");
  });

  it("includes all 10 category IDs", () => {
    const prompt = buildExtractionPrompt("test body");
    expect(prompt).toContain("food");
    expect(prompt).toContain("transport");
    expect(prompt).toContain("entertainment");
    expect(prompt).toContain("health");
    expect(prompt).toContain("education");
    expect(prompt).toContain("home");
    expect(prompt).toContain("clothing");
    expect(prompt).toContain("services");
    expect(prompt).toContain("transfer");
    expect(prompt).toContain("other");
  });

  it("requests JSON output with confidence field", () => {
    const prompt = buildExtractionPrompt("test");
    expect(prompt).toContain('"confidence"');
    expect(prompt).toContain("JSON");
  });
});
