import type { AnyDb } from "@/shared/db";
import type { UserId } from "@/shared/types/branded";
import { getProcessedEmailSourceEventIds } from "../lib/repository";
import type { RawEmail } from "../pipeline.public";
import { getEmailSourceEventKey, getEmailSourceId } from "./email-pipeline-service/shared";
import type { ProcessedEmailAccountFetchResult } from "./email-capture-fetch-service";

function hasPersistedSourceEventsForFetch(
  persistedKeys: ReadonlySet<string>,
  result: ProcessedEmailAccountFetchResult
) {
  if (result.rawEmails.length === 0) return true;
  return result.rawEmails.every((email) => persistedKeys.has(getEmailSourceEventKey(email)));
}

const toSourceEvents = (fetchResults: readonly ProcessedEmailAccountFetchResult[]) =>
  fetchResults.flatMap((result) =>
    result.rawEmails.map((email: RawEmail) => ({
      sourceId: getEmailSourceId(email),
      sourceEventId: email.externalId,
    }))
  );

export const getDurablyProcessedFetches = async (
  db: AnyDb,
  userId: UserId,
  fetchResults: readonly ProcessedEmailAccountFetchResult[]
): Promise<readonly ProcessedEmailAccountFetchResult[]> => {
  const persistedKeys = await getProcessedEmailSourceEventIds(
    db,
    userId,
    toSourceEvents(fetchResults)
  );
  const fetchDurability = fetchResults.map((result) => ({
    result,
    isDurable: result.fetchOk && hasPersistedSourceEventsForFetch(persistedKeys, result),
  }));
  return fetchDurability.filter((entry) => entry.isDurable).map((entry) => entry.result);
};
