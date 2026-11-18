export const TAP_MOVE: number;
export const TAP_MS: number;
export const INSTANT_TARGETS: string;
export function isTap(dx: number, dy: number, ms: number): boolean;
export function markGoing(doc: Document, link: Element): void;
export function installInstantTap(win: Window, doc: Document): void;
