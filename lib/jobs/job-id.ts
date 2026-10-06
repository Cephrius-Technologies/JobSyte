export function formatJobDisplayId(databaseId: string): string {
  return `JS${Number.parseInt(databaseId.slice(-8), 16)}`;
}
