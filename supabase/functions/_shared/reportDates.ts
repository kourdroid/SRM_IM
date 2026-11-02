export const REPORT_TIME_ZONE = 'Africa/Casablanca';

export function reportDateRange(startDate: string, endDate: string): { start: string; end: string } {
  const start = parseDay(startDate);
  const end = parseDay(endDate);
  if (end < start) throw new Error('La date de fin doit suivre la date de debut.');
  return { start: zonedMidnight(start), end: zonedMidnight(end + 86_400_000) };
}

function parseDay(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid report date');
  const instant = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 10) !== day) throw new Error('Invalid report date');
  return instant;
}

function zonedMidnight(day: number): string {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: REPORT_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let instant = day;
  for (let pass = 0; pass < 3; pass += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    const displayed = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const next = instant + day - displayed;
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant).toISOString();
}
