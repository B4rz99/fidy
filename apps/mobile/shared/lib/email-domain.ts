export function extractEmailDomain(email: string): string {
  const atIdx = email.lastIndexOf("@");
  return atIdx >= 0 ? email.slice(atIdx + 1).toLowerCase() : email.toLowerCase();
}
