/** The photograph's size and focal point are resolved by CSS before the first
 * paint. Hydration must never resize or reposition the bottles. */
export function HomeHeroPhoto(){
 return <picture><source media="(min-width:960px)" srcSet="/images/hero-dimensions-2026-11-13/01-mint-woodland-omega-label-v4.png"/><img src="/images/hero-dimensions-2026-11-13/01-mint-woodland-omega-label-v4.png" alt="Жидкий хлорофилл и Омега-3 NSP рядом с белой эхинацеей на тёмном камне" width="1774" height="887" fetchPriority="high"/></picture>;
}
