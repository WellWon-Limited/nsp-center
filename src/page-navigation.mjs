// Routes with an internal return link must not also get the page-level return link.
const informationPaths=new Set(['/payments/','/company/faq/','/contacts/','/shares/','/company/reviews/','/photo/','/video/','/company/consent/','/company/privacy-policy/','/company/refund/']);
export const hasInformationDesign=path=>informationPaths.has(path)||path.startsWith('/contacts/stores/');
export const ownsBackLink=path=>hasInformationDesign(path)||path==='/delivery/'||path==='/design-system/'||path.startsWith('/product/')||path.startsWith('/temy/')||(path.startsWith('/blog/')&&path!=='/blog/')||path==='/company/sertifikaty/';
