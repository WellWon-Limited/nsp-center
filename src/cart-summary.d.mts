import type { Product } from './content-types';
export const COURIER_RUB: number;
export const FREE_COURIER_FROM: number;
export function cartSummary(products: Product[], cart: Record<string, number>, unselected: string[], card: boolean): { chosen: Product[]; count: number; retail: number; withCard: number; total: number; saving: number; courier: number; freeCourierLeft: number };
