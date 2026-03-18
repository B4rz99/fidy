import { describe, expect, it } from "vitest";
import { parseNotificationLocally } from "@/features/capture-sources/lib/notification-parser";

describe("parseNotificationLocally", () => {
  describe("Bancolombia notifications", () => {
    it("parses purchase notification", () => {
      const result = parseNotificationLocally(
        "Bancolombia le informa compra por $50,000 en EDS LA CASTELLANA. "
      );
      expect(result).toEqual({
        amount: 50000,
        merchant: "EDS LA CASTELLANA",
        type: "expense",
      });
    });

    it("parses transfer out notification", () => {
      const result = parseNotificationLocally(
        "Bancolombia le informa transferencia por $100,000 a JUAN PEREZ. "
      );
      expect(result).toEqual({
        amount: 100000,
        merchant: "JUAN PEREZ",
        type: "expense",
      });
    });

    it("parses transfer in notification", () => {
      const result = parseNotificationLocally(
        "Bancolombia le informa transferencia por $200,000 de MARIA GARCIA. "
      );
      expect(result).toEqual({
        amount: 200000,
        merchant: "MARIA GARCIA",
        type: "income",
      });
    });

    it("parses deposit notification", () => {
      const result = parseNotificationLocally("Bancolombia le informa depósito por $500,000. ");
      expect(result).toEqual({
        amount: 500000,
        merchant: "Depósito",
        type: "income",
      });
    });
  });

  describe("BBVA notifications", () => {
    it("parses purchase notification", () => {
      const result = parseNotificationLocally("BBVA: Compra aprobada por $35,000 en FALABELLA. ");
      expect(result).toEqual({
        amount: 35000,
        merchant: "FALABELLA",
        type: "expense",
      });
    });
  });

  describe("Nequi notifications", () => {
    it("parses sent money notification", () => {
      const result = parseNotificationLocally("Enviaste $20,000 a Maria Garcia. ");
      expect(result).toEqual({
        amount: 20000,
        merchant: "Maria Garcia",
        type: "expense",
      });
    });

    it("parses received money notification", () => {
      const result = parseNotificationLocally("Recibiste $30,000 de Pedro Lopez. ");
      expect(result).toEqual({
        amount: 30000,
        merchant: "Pedro Lopez",
        type: "income",
      });
    });
  });

  describe("Daviplata notifications", () => {
    it("parses payment notification", () => {
      const result = parseNotificationLocally("Daviplata: Pagaste $15,000 en TIENDA XYZ. ");
      expect(result).toEqual({
        amount: 15000,
        merchant: "TIENDA XYZ",
        type: "expense",
      });
    });
  });

  describe("Google Wallet notifications", () => {
    it("parses English payment notification", () => {
      const result = parseNotificationLocally("Payment of $25,000 at STARBUCKS. ");
      expect(result).toEqual({
        amount: 25000,
        merchant: "STARBUCKS",
        type: "expense",
      });
    });

    it("parses Spanish payment notification", () => {
      const result = parseNotificationLocally("Pago de $7,500 en FARMATODO. ");
      expect(result).toEqual({
        amount: 7500,
        merchant: "FARMATODO",
        type: "expense",
      });
    });
  });

  describe("amount parsing edge cases", () => {
    it("handles dot as thousands separator", () => {
      const result = parseNotificationLocally(
        "Bancolombia le informa compra por $50.000 en EXITO. "
      );
      expect(result).toEqual({
        amount: 50000,
        merchant: "EXITO",
        type: "expense",
      });
    });

    it("handles no separators", () => {
      const result = parseNotificationLocally(
        "Bancolombia le informa compra por $50000 en EXITO. "
      );
      expect(result).toEqual({
        amount: 50000,
        merchant: "EXITO",
        type: "expense",
      });
    });

    it("handles large amounts with multiple separators", () => {
      const result = parseNotificationLocally(
        "Bancolombia le informa compra por $1,500,000 en HOMECENTER. "
      );
      expect(result).toEqual({
        amount: 1500000,
        merchant: "HOMECENTER",
        type: "expense",
      });
    });
  });

  describe("no match", () => {
    it("returns null for empty string", () => {
      expect(parseNotificationLocally("")).toBeNull();
    });

    it("returns null for unrelated notification", () => {
      expect(parseNotificationLocally("Tu paquete de MercadoLibre esta en camino")).toBeNull();
    });

    it("returns null for notification without amount", () => {
      expect(
        parseNotificationLocally("Bancolombia le informa que su clave fue cambiada")
      ).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("returns null when amount cannot be parsed", () => {
      const result = parseNotificationLocally("Bancolombia le informa compra por $abc en STORE. ");
      expect(result).toBeNull();
    });

    it("returns null when parsed amount is zero", () => {
      const result = parseNotificationLocally("Bancolombia le informa compra por $0 en STORE. ");
      expect(result).toBeNull();
    });

    it("returns null when merchant is empty", () => {
      const result = parseNotificationLocally("Bancolombia le informa compra por $50000 en . ");
      expect(result).toBeNull();
    });
  });
});
