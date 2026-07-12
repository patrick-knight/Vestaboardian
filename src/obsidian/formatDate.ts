// Supported tokens: YYYY, MM, DD, HH, mm. Replaced in a single pass so
// repeated tokens all substitute and replaced output is never re-matched
// (sequential .replace calls would turn "DD MMM" into "11 07M").
export function formatDate(d: Date, fmt: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const tokens: Record<string, string> = {
    YYYY: String(d.getFullYear()),
    MM: pad(d.getMonth() + 1),
    DD: pad(d.getDate()),
    HH: pad(d.getHours()),
    mm: pad(d.getMinutes()),
  };
  return fmt.replace(/YYYY|MM|DD|HH|mm/g, (t) => tokens[t]);
}
