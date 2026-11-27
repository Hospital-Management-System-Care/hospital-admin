// Display helpers shared by the admin pages.

// The API's business calendar is Karachi (UTC+5).
export const BUSINESS_TZ = "Asia/Karachi";
const DAY_MS = 24 * 60 * 60 * 1000;

// The API returns ISO instants. A zoneless MySQL-style "YYYY-MM-DD HH:mm:ss" string is
// read as Karachi time, which is the API database's session time zone.
export const toMs = (value) => {
  if (value == null || value === "") return NaN;
  if (value instanceof Date) return value.getTime();
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text)) return Date.parse(`${text.replace(" ", "T")}+05:00`);
  return Date.parse(text);
};

export const pkr = (value) =>
  `PKR ${Number(value || 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const displayDate = (value) => {
  const ms = toMs(value);
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleString();
};

export const displayMethod = (value) => String(value || "—").replaceAll("_", " ");

const formatBusinessDay = (ms) =>
  new Date(ms).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: BUSINESS_TZ });

// A period starts at an instant and ends *exclusively* at the midnight that begins the next
// day, so the last day shown is the one containing `end - 1ms` (same as the API's endsOnDate).
export const startDay = (value) => {
  const ms = toMs(value);
  return Number.isNaN(ms) ? "—" : formatBusinessDay(ms);
};
export const endDay = (value) => {
  const ms = toMs(value);
  return Number.isNaN(ms) ? "—" : formatBusinessDay(ms - 1);
};

export const isPast = (value) => {
  const ms = toMs(value);
  return !Number.isNaN(ms) && ms <= Date.now();
};

// Whole days elapsed since `value`, for display only (the API decides the refund tier).
export const daysSince = (value) => {
  const ms = toMs(value);
  if (Number.isNaN(ms)) return "—";
  const days = Math.max(0, Math.floor((Date.now() - ms) / DAY_MS));
  return `${days} ${days === 1 ? "day" : "days"}`;
};
