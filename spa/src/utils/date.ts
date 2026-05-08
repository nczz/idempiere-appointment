/** YYYY-MM-DD */
export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/** HH:MM */
export function toTimeStr(d: Date): string {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

/** YYYY-MM-DDTHH:MM */
export function toDateTimeStr(d: Date): string {
  return `${toDateStr(d)}T${toTimeStr(d)}`;
}

/** Today as YYYY-MM-DD */
export function todayStr(): string {
  return toDateStr(new Date());
}
