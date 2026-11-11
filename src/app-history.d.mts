export const TAB_LINKS: string;
export function nextStack(stack: string[], here: string, to: string, tab: boolean): string[];
export function appHistory(): boolean;
export function previousPage(win: Window): string | null;
export function goBack(win: Window, fallback: string): boolean;
export function openedByBack(win: Window): boolean;
export function installAppHistory(win: Window, doc: Document, standalone: boolean): void;
