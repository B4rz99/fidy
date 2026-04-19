import { CATEGORY_IDS } from "@/features/transactions";
import { createParseEmailService } from "./create-parse-email-service";

export const liveParseEmailService = createParseEmailService({
  validCategoryIds: CATEGORY_IDS,
});
