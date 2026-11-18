/** Convert viewport measurements to CSS pixels inside a proportionally scaled page. */
export function layoutScale(element){
 const width=element?.getBoundingClientRect?.().width,base=element?.offsetWidth;
 return width>0&&base>0?width/base:1;
}
