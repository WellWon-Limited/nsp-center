export const CART_NOTICE_MS = 3200;
/** Count additions of the same product while its current notification remains visible. */
export function nextCartNotice(previous, id, quantity, now) {
  return { id, quantity: (previous?.id === id && previous.expiresAt > now ? previous.quantity : 0) + quantity, expiresAt: now + CART_NOTICE_MS };
}
