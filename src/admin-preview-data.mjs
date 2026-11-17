/** Compose a read-only copy: unchanged saved fields survive a partial editor draft. */
export function previewProduct(full,summary,saved={},draft={}){
 const p=structuredClone({...full,...summary,sections:{...full.sections,...summary.sections},sectionsHtml:{...full.sectionsHtml,...summary.sectionsHtml},properties:{...full.properties,...summary.properties},hidden:false});
 const own={...saved,...draft};
 p.name=own.name??summary.name??full.name;
 p.properties=Object.fromEntries(Object.entries({...p.properties,...saved.properties,...draft.properties}).filter(([,v])=>v));
 if(saved.properties||draft.properties)p.adminProperties={...saved.properties,...draft.properties};
 if(own.about!==undefined||own.highlights!==undefined)p.copy={about:own.about??p.knowledge?.about??p.copy?.about??[],highlights:own.highlights??p.knowledge?.highlights??p.copy?.highlights??[]};
 if(own.summary!==undefined)p.card={...(p.card||{kicker:'',parts:[],more:0,notes:p.experts?.length||0}),sub:own.summary};
 if(own.documents!==undefined)p.documents=own.documents.map(d=>({...d,size:''}));
 if(own.photos!==undefined){p.adminPhotos=own.photos;p.adminImage=own.photos[0]||'';}
 else if(own.image!==undefined)p.adminImage=own.image;
 if(own.videos!==undefined)p.adminVideos=own.videos;
 return p;
}
