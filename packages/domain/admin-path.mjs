/** The staff entry address is shared by routing, navigation, rendering and offline exclusions. */
export const ADMIN_PATH='/office-k7m4q9/';
export function isStaffPage(value){const path=String(value||'').split(/[?#]/)[0];return path===ADMIN_PATH.slice(0,-1)||path.startsWith(ADMIN_PATH)||/^\/admin(\/|$)/.test(path);}
