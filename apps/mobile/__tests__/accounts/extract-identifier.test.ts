import { describe, expect, it } from "vitest";
import { extractCardIdentifier } from "@/features/accounts/lib/extract-identifier";

describe("extractCardIdentifier", () => {
  it("extracts card name from 'tarjeta Visa Oro en'", () => {
    expect(extractCardIdentifier("Compra con tarjeta Visa Oro en Exito por $50,000.")).toBe(
      "Visa Oro"
    );
  });

  it("extracts card name from 'tarjeta Visa Oro por'", () => {
    expect(extractCardIdentifier("Compra con tarjeta Visa Oro por $120,000 en Falabella.")).toBe(
      "Visa Oro"
    );
  });

  it("extracts last 4 digits from *1234 format", () => {
    expect(extractCardIdentifier("Compra aprobada *4521 por $30,000 en Amazon.")).toBe("*4521");
  });

  it("extracts last 4 digits from ****1234 format", () => {
    expect(extractCardIdentifier("Tu tarjeta ****7890 compra por $15,000.")).toBe("*7890");
  });

  it("returns null when no identifier found", () => {
    expect(extractCardIdentifier("Recibiste $50,000 de Juan Perez.")).toBeNull();
  });

  it("returns null for empty text", () => {
    expect(extractCardIdentifier("")).toBeNull();
  });

  it("prefers card name over last 4 digits when both present", () => {
    expect(extractCardIdentifier("Tarjeta Visa Oro *1234 compra por $50,000.")).toBe("Visa Oro");
  });

  it("extracts card name with accented characters", () => {
    expect(extractCardIdentifier("Compra con tarjeta Visa débito en Almacenes.")).toBe(
      "Visa débito"
    );
  });

  it("extracts card name with ñ and accented vowels", () => {
    expect(extractCardIdentifier("Compra con tarjeta Visa Clásica por $80,000.")).toBe(
      "Visa Clásica"
    );
  });
});
