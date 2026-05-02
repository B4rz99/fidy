import { describe, expect, it } from "vitest";
import { parseNotificationLocalHint } from "@/features/capture-sources/lib/notification-parser";

describe("parseNotificationLocalHint", () => {
  describe("Bancolombia notifications", () => {
    it("extracts purchase notification as a hint", () => {
      const result = parseNotificationLocalHint(
        "Bancolombia le informa compra por $50,000 en EDS LA CASTELLANA. "
      );
      expect(result).toEqual({
        type: "expense",
      });
    });

    it("extracts transfer out notification as a hint", () => {
      const result = parseNotificationLocalHint(
        "Bancolombia le informa transferencia por $100,000 a JUAN PEREZ. "
      );
      expect(result).toEqual({
        type: "expense",
      });
    });

    it("extracts transfer in notification as a hint", () => {
      const result = parseNotificationLocalHint(
        "Bancolombia le informa transferencia por $200,000 de MARIA GARCIA. "
      );
      expect(result).toEqual({
        type: "income",
      });
    });

    it("extracts deposit notification as a hint", () => {
      const result = parseNotificationLocalHint("Bancolombia le informa depósito por $500,000. ");
      expect(result).toEqual({
        type: "income",
      });
    });
  });

  describe("BBVA notifications", () => {
    it("extracts purchase notification as a hint", () => {
      const result = parseNotificationLocalHint("BBVA: Compra aprobada por $35,000 en FALABELLA. ");
      expect(result).toEqual({
        type: "expense",
      });
    });
  });

  describe("Nequi notifications", () => {
    it("extracts sent money notification as a hint", () => {
      const result = parseNotificationLocalHint("Enviaste $20,000 a Maria Garcia. ");
      expect(result).toEqual({
        type: "expense",
      });
    });

    it("extracts received money notification as a hint", () => {
      const result = parseNotificationLocalHint("Recibiste $30,000 de Pedro Lopez. ");
      expect(result).toEqual({
        type: "income",
      });
    });
  });

  describe("Daviplata notifications", () => {
    it("extracts payment notification as a hint", () => {
      const result = parseNotificationLocalHint("Daviplata: Pagaste $15,000 en TIENDA XYZ. ");
      expect(result).toEqual({
        type: "expense",
      });
    });
  });

  describe("Google Wallet notifications", () => {
    it("extracts English payment notification as a hint", () => {
      const result = parseNotificationLocalHint("Payment of $25,000 at STARBUCKS. ");
      expect(result).toEqual({
        type: "expense",
      });
    });

    it("extracts Spanish payment notification as a hint", () => {
      const result = parseNotificationLocalHint("Pago de $7,500 en FARMATODO. ");
      expect(result).toEqual({
        type: "expense",
      });
    });
  });

  describe("generic purchase fallback", () => {
    it("extracts generic purchase notifications as hints for the LLM", () => {
      const result = parseNotificationLocalHint(
        "Tu compra fue aprobada por $18,900 en CAFETERIA CENTRAL. "
      );
      expect(result).toEqual({
        type: "expense",
      });
    });
  });

  describe("amount parsing edge cases", () => {
    it("handles dot as thousands separator", () => {
      const result = parseNotificationLocalHint(
        "Bancolombia le informa compra por $50.000 en EXITO. "
      );
      expect(result).toEqual({ type: "expense" });
    });

    it("handles no separators", () => {
      const result = parseNotificationLocalHint(
        "Bancolombia le informa compra por $50000 en EXITO. "
      );
      expect(result).toEqual({ type: "expense" });
    });

    it("handles large amounts with multiple separators", () => {
      const result = parseNotificationLocalHint(
        "Bancolombia le informa compra por $1,500,000 en HOMECENTER. "
      );
      expect(result).toEqual({ type: "expense" });
    });
  });

  describe("no match", () => {
    it("returns null for empty string", () => {
      expect(parseNotificationLocalHint("")).toBeNull();
    });

    it("returns null for unrelated notification", () => {
      expect(parseNotificationLocalHint("Tu paquete de MercadoLibre esta en camino")).toBeNull();
    });

    it("returns null for notification without amount", () => {
      expect(
        parseNotificationLocalHint("Bancolombia le informa que su clave fue cambiada")
      ).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns null when amount cannot be parsed", () => {
      const result = parseNotificationLocalHint(
        "Bancolombia le informa compra por $abc en STORE. "
      );
      expect(result).toBeNull();
    });

    it("returns null when parsed amount is zero", () => {
      const result = parseNotificationLocalHint("Bancolombia le informa compra por $0 en STORE. ");
      expect(result).toBeNull();
    });

    it("returns null when merchant is empty", () => {
      const result = parseNotificationLocalHint("Bancolombia le informa compra por $50000 en . ");
      expect(result).toBeNull();
    });
  });
});
