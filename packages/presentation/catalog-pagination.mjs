/** Twelve is divisible by the catalog's 4-, 3-, 2- and 1-column grids. Only the final page may end in a partial row. */
export function catalogPagination(total,requestedPages=0,target=28){
 total=Math.max(0,Math.floor(total));
 const unit=12,pages=Math.max(1,Math.min(requestedPages||Math.ceil(total/target),Math.ceil(total/unit)||1));
 if(pages===1)return [{start:0,end:total,count:total}];
 const blocks=Math.floor(total/unit),remainder=total%unit;
 let lastBlocks=Math.floor(blocks/pages);
 while(lastBlocks>0&&lastBlocks*unit+remainder>Math.floor((blocks-lastBlocks)/(pages-1))*unit)lastBlocks--;
 if(lastBlocks===0&&!remainder)lastBlocks=1;
 const left=blocks-lastBlocks,base=Math.floor(left/(pages-1)),extra=left%(pages-1);
 const counts=Array.from({length:pages-1},(_,i)=>(base+(i<extra?1:0))*unit);counts.push(lastBlocks*unit+remainder);
 let start=0;return counts.map(count=>{const slice={start,end:start+count,count};start+=count;return slice});
}
