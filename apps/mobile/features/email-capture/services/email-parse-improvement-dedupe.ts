import { and, eq, sql } from "drizzle-orm";
import type { AnyDb } from "@/shared/db";
import { emailParseImprovementSamples } from "@/shared/db/schema";
import type { UserId } from "@/shared/types/branded";

type EmailParseImprovementSampleDedupeInput = {
  readonly senderDomain: string | null | undefined;
  readonly source: string;
  readonly status: string;
  readonly parseMethod: string;
  readonly template: string;
};

export const getEmailParseImprovementSampleDedupeKey = (
  sample: EmailParseImprovementSampleDedupeInput
): string =>
  [
    sample.senderDomain ?? "",
    sample.source,
    sample.status,
    sample.parseMethod,
    sample.template,
  ].join("\u001f");

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
          sql`coalesce(${emailParseImprovementSamples.senderDomain}, '') = ${
            input.sample.senderDomain ?? ""
          }`,
          eq(emailParseImprovementSamples.template, input.sample.template)
        )
      )
      .limit(1)
      .get()
  );
}
