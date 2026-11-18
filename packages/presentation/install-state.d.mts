export type InstallPlatform='ios'|'android'|'edge'|'chromium'|'mac-safari'|'other';
export function runningAsApp(env:Window):boolean;
export function installationOnPhone(nav:Navigator):boolean;
export function installationPlatform(nav:Navigator):InstallPlatform;
export function relatedAppInstalled(env:Window):Promise<boolean>;
