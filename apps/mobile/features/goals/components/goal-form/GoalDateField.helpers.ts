export function getMinimumGoalDate(now: Date = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
