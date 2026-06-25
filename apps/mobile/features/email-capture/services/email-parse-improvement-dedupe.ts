import { and, eq, isNull } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { emailParseImprovementSamples } from "@/shared/db/schema";
import type { UserId } from "@/shared/types/branded";

type EmailParseImprovementSampleDedupeInput = {
  readonly providerCategory: string;
  readonly source: string;
  readonly status: string;
  readonly parseMethod: string;
  readonly template: string;
};

export const getEmailParseImprovementSampleDedupeKey = (
  sample: EmailParseImprovementSampleDedupeInput
): string =>
  [sample.providerCategory, sample.source, sample.status, sample.parseMethod, sample.template].join(
    "\u001f"
  );

export function hasEmailParseImprovementSample(input: {
  readonly db: AnyDb;
  readonly userId: UserId;
  readonly sample: EmailParseImprovementSampleDedupeInput;
}): boolean {
  return Boolean(
    input.db
      .select({ id: emailParseImprovementSamples.id })
      .from(emailParseImprovementSamples)
      .where(
        and(
          eq(emailParseImprovementSamples.userId, input.userId),
          eq(emailParseImprovementSamples.source, input.sample.source),
          eq(emailParseImprovementSamples.status, input.sample.status),
          eq(emailParseImprovementSamples.parseMethod, input.sample.parseMethod),
          eq(emailParseImprovementSamples.providerCategory, input.sample.providerCategory),
          eq(emailParseImprovementSamples.template, input.sample.template),
          isNull(emailParseImprovementSamples.deletedAt)
        )
      )
      .limit(1)
      .get()
  );
}
