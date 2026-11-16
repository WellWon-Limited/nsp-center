export type ProductBadges = { discountPercent: number; isNew: boolean; isHit: boolean };
export const DISCOUNT_PERCENTS: readonly number[];
export function readProductBadges(input: unknown): ProductBadges;
export function validateProductBadges(input: unknown): { value: ProductBadges; error?: undefined } | { error: string; value?: undefined };
export function productBadgeLabels(input: unknown): { kind: string; text: string }[];
