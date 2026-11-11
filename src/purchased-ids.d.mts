type Order = { date?: string; products?: Record<string, number> };
export function purchased(orders: Order[], knownIds: Set<string>): { id: string; date: string; times: number }[];
export function purchasedIds(orders: Order[], knownIds: Set<string>): string[];
export function orderDate(date: string): string;
