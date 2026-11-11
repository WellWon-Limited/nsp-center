export function isBackSwipe(startX: number, dx: number, dy: number, ms: number): boolean;
export function standaloneIos(win: Window): boolean;
export function installSwipeBack(win: Window, doc: Document): () => void;
export const BACK_BUTTONS: string;
export function backButton(doc: Document): HTMLAnchorElement | null;
