import type { Schedule } from "../contracts/models";

export function nextOccurrence(schedule: Schedule, after: Date): Date {
  if (schedule.cadence === "interval") {
    const minutes = schedule.intervalMinutes;
    if (!minutes || minutes < 1) {
      throw new Error("Interval schedule requires intervalMinutes");
    }
    return new Date(after.getTime() + minutes * 60_000);
  }
  if (!schedule.localTime) {
    throw new Error("Daily schedule requires localTime");
  }
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(schedule.localTime);
  if (!match) {
    throw new Error("Daily schedule localTime must use HH:MM");
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const next = new Date(after);
  next.setHours(hours, minutes, 0, 0);
  if (next <= after) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export function shouldCatchUp(
  lastDue: Date,
  lastRun: Date | undefined,
  now: Date,
): boolean {
  return lastDue <= now && (!lastRun || lastRun < lastDue);
}

export function alarmName(recipeId: string): string {
  return `scrapeyy:recipe:${recipeId}`;
}

export function recipeIdFromAlarm(name: string): string | undefined {
  const prefix = "scrapeyy:recipe:";
  return name.startsWith(prefix) && name.length > prefix.length
    ? name.slice(prefix.length)
    : undefined;
}
