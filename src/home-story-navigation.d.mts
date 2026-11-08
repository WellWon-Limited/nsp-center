export function homeStoryReturn(url:string):string|null;
export function homeStoryLinks(html:string,section:string):string;

export function homeStoryIsOpen(state:unknown):boolean;
export function rememberHomeStory(history:History,open:boolean):void;
