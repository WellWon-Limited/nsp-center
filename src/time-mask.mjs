// Typing a time in the plan («Время приёма»). The phone keypad for numbers has no colon, so the field puts it in itself:
// the colon appears as soon as the hours are known, a single hour is padded («9» -> «09:»), digits that cannot start
// a time are moved or ignored («25» -> «02:5», no hour 24-29 and no minute 60-99), and on leaving the field an unfinished
// entry is completed («8» -> «08:00», «12:3» -> «12:30»).

/** Formats what is in the field after a keystroke. `previous` is the text before it, so deleting the colon also deletes
 *  the hour digit in front of it instead of the colon coming straight back. */
export function maskTime(raw, previous = '') {
  let hours = '';
  let minutes = '';
  let closed = false;
  for (const ch of String(raw)) {
    if (ch >= '0' && ch <= '9') {
      if (!closed && hours.length < 2) {
        if (!hours) hours = ch > '2' ? `0${ch}` : ch;
        else if (Number(hours + ch) <= 23) hours += ch;
        else { hours = `0${hours}`; if (ch <= '5') minutes = ch; }
        if (hours.length === 2) closed = true;
      } else if (minutes.length < 2 && (minutes || ch <= '5')) minutes += ch;
    } else if (hours.length === 1 && !closed) { hours = `0${hours}`; closed = true; }
  }
  const text = hours.length === 2 ? `${hours}:${minutes}` : hours;
  if (String(raw).length < String(previous).length && text === previous) return previous.endsWith(':') ? previous.slice(0, -2) : text.slice(0, -1);
  return text;
}

/** Completes an entry when the field is left: «8» -> «08:00», «08:» -> «08:00», «12:3» -> «12:30»; empty stays empty. */
export function finishTime(text) {
  const masked = maskTime(text);
  if (!masked) return '';
  const [hours, minutes = ''] = masked.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padEnd(2, '0')}`;
}

export const validTime = text => /^([01]\d|2[0-3]):[0-5]\d$/.test(text);
