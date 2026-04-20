import type { StoredActivityItem } from "../services/create-activity-query-service";

function getActivityIdentity(item: StoredActivityItem): string {
  return `${item.kind}:${item.id}`;
}

export function appendUniqueActivityItems(
  current: readonly StoredActivityItem[],
  next: readonly StoredActivityItem[]
): readonly StoredActivityItem[] {
  const seen = new Set(current.map(getActivityIdentity));
  const appended = next.filter((item) => {
    const identity = getActivityIdentity(item);

    if (seen.has(identity)) {
      return false;
    }

    seen.add(identity);
    return true;
  });

  return [...current, ...appended];
}
