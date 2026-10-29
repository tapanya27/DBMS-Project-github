/** Format DB timestamps for the user's local timezone (e.g. IST). */
export function formatDateTime(
  value: string | Date | null | undefined
): string {
  if (value == null || value === "") return "—";

  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else {
    const raw = String(value).trim();
    // Neon often returns "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" without Z.
    // Those are stored in UTC — treat as UTC so local conversion is correct.
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(raw) && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
      date = new Date(raw.replace(" ", "T") + "Z");
    } else {
      date = new Date(raw);
    }
  }

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
