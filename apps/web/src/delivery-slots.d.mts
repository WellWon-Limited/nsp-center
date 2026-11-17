export const WINDOWS: { id: string; label: string; start: number }[];
export const DAYS_AHEAD: number;
export function spbClock(now?: Date): { y: number; m: number; d: number; hour: number; minute: number };
export type DeliveryDay = { date: string; label: string; sub: string; windows: { id: string; label: string; free: boolean }[] };
export function deliveryDays(now?: Date): DeliveryDay[];
export function earliestSlot(days: DeliveryDay[]): { date: string; window: string };
