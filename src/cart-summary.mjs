// Sums of the cart's "Ваш заказ" (src/cart.tsx), kept apart so the rules are tested: only ticked products that are in
// stock count; the discount is the difference between retail and card prices; the courier within the ring road (КАД)
// costs 350 ₽ and is free from 12 000 ₽ of the total actually paid (terms of /delivery/).
export const COURIER_RUB = 350, FREE_COURIER_FROM = 12000;
const price = (p, card) => card && p.prices.partner !== null ? p.prices.partner : p.prices.retail;
export function cartSummary(products, cart, unselected, card) {
  const chosen = products.filter(p => cart[p.id] && p.availability !== 'OutOfStock' && !unselected.includes(p.id));
  const count = chosen.reduce((n, p) => n + cart[p.id], 0);
  const sumAt = withCard => chosen.reduce((s, p) => s + price(p, withCard) * cart[p.id], 0);
  const retail = sumAt(false), withCard = sumAt(true), total = card ? withCard : retail;
  return { chosen, count, retail, withCard, total, saving: retail - withCard, courier: total >= FREE_COURIER_FROM ? 0 : COURIER_RUB, freeCourierLeft: Math.max(0, FREE_COURIER_FROM - total) };
}
