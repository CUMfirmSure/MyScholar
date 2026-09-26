import { addDays } from "date-fns";
import type { Reminder } from "../types";
import { parseDay } from "./dates";

export function reminderMoment(reminder: Reminder): Date {
  const date = parseDay(reminder.dueDate);
  const [hh, mm] = (reminder.dueTime || "23:59").split(":").map(Number);
  date.setHours(Number.isNaN(hh) ? 23 : hh, Number.isNaN(mm) ? 59 : mm, 0, 0);
  return date;
}

export function reminderDue(reminder: Reminder): number {
  return reminderMoment(reminder).getTime();
}

export function remindAt(reminder: Reminder): Date {
  const days = Math.max(0, Math.min(30, reminder.remindDaysBefore || 0));
  return addDays(reminderMoment(reminder), -days);
}

export function shouldNotify(reminder: Reminder, now = new Date()): boolean {
  if (reminder.completed || reminder.notified) return false;
  return now.getTime() >= remindAt(reminder).getTime();
}

export async function requestNotifyPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

/**
 * On-device notifications while ScholarFlow is open.
 * Limitation: background delivery on Android needs the Capacitor Local Notifications
 * plugin in a device build. This web shell uses the Notification API plus in-app banners,
 * and never calls a server.
 */
export function pushSystemNotification(title: string, body: string) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body });
  } catch {
    /* WebView may reject Notification outside a user gesture. In-app banner still shows. */
  }
}

export function notifyPermission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}
