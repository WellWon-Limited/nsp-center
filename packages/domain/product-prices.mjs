export function pricesUnder(p, original, site, buildRate) {
  const o = site?.products[p.id];
  const rate = site?.rate?.rubPerUnit ?? buildRate;
  const units = { retail: o?.retailUnits ?? p.prices.units?.retail ?? null, partner: o?.partnerUnits ?? p.prices.units?.partner ?? null };
  const fromUnits = (u, built) => u === null ? built : Math.round(u * rate);
  return { retail: o?.retailRub ?? fromUnits(units.retail, original.retail) ?? original.retail, partner: o?.partnerRub ?? fromUnits(units.partner, original.partner) };
}
