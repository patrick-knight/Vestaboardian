export function formatDate(d: Date, fmt: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return fmt
    .replace("YYYY", String(d.getFullYear()))
    .replace("MM", pad(d.getMonth() + 1))
    .replace("DD", pad(d.getDate()))
    .replace("HH", pad(d.getHours()))
    .replace("mm", pad(d.getMinutes()));
}
