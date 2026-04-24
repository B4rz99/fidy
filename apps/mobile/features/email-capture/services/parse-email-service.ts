import { CATEGORY_IDS } from "@/shared/categories";
import { createParseEmailService } from "./create-parse-email-service";

export const liveParseEmailService = createParseEmailService({
  validCategoryIds: CATEGORY_IDS,
});
