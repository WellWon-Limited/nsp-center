export type CartNotice = {id:string;quantity:number;expiresAt:number};
export const CART_NOTICE_MS: number;
export function nextCartNotice(previous: CartNotice|null, id:string, quantity:number, now:number):CartNotice;
