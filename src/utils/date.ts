export function getCurrentDayOfWeek(): number {
  const day = new Date().getDay();
  return day === 0 ? 7 : day;
}

export function getWeekStartDate(weekOffset: number): Date {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay() + 1 - weekOffset * 7);
  start.setHours(0, 0, 0, 0);
  return start;
}
