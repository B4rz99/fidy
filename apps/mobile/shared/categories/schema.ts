import { z } from "zod";
import { requireCategoryId } from "@/shared/types/assertions";
import { isValidCategoryId } from "./registry";

export function makeCategoryIdSchema(isValid: (id: string) => boolean) {
  return z
    .string()
    .refine(isValid, { message: "Invalid category ID" })
    .transform((value) => requireCategoryId(value));
}

export const categoryIdSchema = makeCategoryIdSchema(isValidCategoryId);
