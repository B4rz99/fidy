import { CATEGORY_IDS } from "@/shared/categories";
import { createParseEmailService } from "./create-parse-email-service";

export const liveParseEmailService = createParseEmailService({
  validCategoryIds: CATEGORY_IDS,
});

export const retryableParseEmailService = createParseEmailService({
  validCategoryIds: CATEGORY_IDS,
  throwOnApiFailure: true,
});

export const retryableReviewableParseEmailService = createParseEmailService({
  validCategoryIds: CATEGORY_IDS,
  throwOnApiFailure: true,
  throwOnNeedsReview: true,
});

export const reviewableParseEmailService = createParseEmailService({
  validCategoryIds: CATEGORY_IDS,
  throwOnNeedsReview: true,
});
