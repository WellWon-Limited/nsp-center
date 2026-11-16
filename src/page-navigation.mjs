// Routes with an internal return link must not also get the page-level return link.
const informationPaths=new Set(['/payments/','/company/faq/','/contacts/','/shares/','/company/reviews/','/photo/','/video/','/company/consent/','/company/privacy-policy/','/company/refund/']);
export const hasInformationDesign=path=>informationPaths.has(path)||path.startsWith('/contacts/stores/');
export const ownsBackLink=path=>hasInformationDesign(path)||path==='/delivery/'||path==='/design-system/'||path.startsWith('/product/')||path.startsWith('/temy/')||(path.startsWith('/blog/')&&path!=='/blog/')||path==='/company/sertifikaty/';

// Pages of the top level (research 2026-11-14: Apple HIG tab bars, Android navigation principles, GOV.UK back link —
// a page reached from the main menu, the tab bar or the phone menu has no back link; the menu itself is the way on).
// Only pages one step deeper (a catalog section, a product, an article, a theme page, the certificates, the documents)
// get «‹ Раздел» back to their parent.
// The footer's documents (privacy policy, public offer, refund terms) have no back link either (owner, 2026-11-14).
export const TOP_LEVEL = new Set(['/company/consent/', '/company/privacy-policy/', '/company/refund/', '/', '/catalog/', '/health/', '/health-marafon/', '/blog/', '/company/', '/delivery/', '/payments/', '/company/reviews/', '/contacts/', '/company/faq/', '/shares/', '/cart/', '/personal/basket/', '/profile/', '/personal/profile/', '/consultation/']);
export const isTopLevel = path => TOP_LEVEL.has(path);
