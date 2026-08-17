export function compactNumber(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year:
      date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function relativeDate(value: string): string {
  const days = Math.round(
    (new Date(value).getTime() - Date.now()) / 86_400_000,
  );
  if (!Number.isFinite(days)) return "Recently";
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    days,
    "day",
  );
}
