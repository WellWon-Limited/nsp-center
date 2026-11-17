/** Navigation to the customer website is explicit; rendering never depends on this address. */
export const siteUrl=(path='/')=>new URL(path,document.querySelector<HTMLMetaElement>('meta[name="nsp-site-origin"]')?.content||'http://127.0.0.1:5217').href;
