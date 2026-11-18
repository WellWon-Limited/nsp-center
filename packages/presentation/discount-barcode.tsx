// Code 128 (set B) bars for the card number, so the barcode on the card encodes the real number.
const code128 = '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'.split(' ');
export function Barcode({ value }: { value: string }) {
  const codes = [...value].map(ch => ch.charCodeAt(0) - 32);
  const check = codes.reduce((sum, c, i) => sum + c * (i + 1), 104) % 103;
  const widths = [104, ...codes, check, 106].flatMap(c => [...code128[c]].map(Number));
  let x = 10; const bars: [number, number][] = [];
  widths.forEach((w, i) => { if (i % 2 === 0) bars.push([x, w]); x += w; });
  return <svg className="discount-barcode" viewBox={`0 0 ${x + 10} 40`} preserveAspectRatio="none" role="img" aria-label={`Штрихкод карты ${value}`}>{bars.map(([bx, w]) => <rect key={bx} x={bx} y="0" width={w} height="40" />)}</svg>;
}
