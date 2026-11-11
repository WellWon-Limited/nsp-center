import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { maskTime, finishTime, validTime } from '../src/time-mask.mjs';

const typed = keys => [...keys].reduce((text, key) => maskTime(text + key, text), '');

test('the colon appears by itself as soon as the hours are known', () => {
  assert.equal(typed('1'), '1');
  assert.equal(typed('12'), '12:');
  assert.equal(typed('1230'), '12:30');
  assert.equal(typed('9'), '09:', 'an hour that cannot have a second digit');
  assert.equal(typed('930'), '09:30');
  assert.equal(typed('0745'), '07:45');
});

test('digits that cannot be a time are moved or ignored', () => {
  assert.equal(typed('245'), '02:45', 'no hour 24: «245» is 2:45');
  assert.equal(typed('127'), '12:', 'no minute 70-79');
  assert.equal(typed('12301'), '12:30', 'five digits stop at the minutes');
  assert.equal(typed('8.15'), '08:15', 'a dot or a colon after one digit closes the hour');
  assert.equal(maskTime('12:30'), '12:30', 'a pasted time is kept');
});

test('backspace goes through the colon instead of bouncing on it', () => {
  assert.equal(maskTime('12', '12:'), '1');
  assert.equal(maskTime('12:3', '12:30'), '12:3');
  assert.equal(maskTime('', '1'), '');
});

test('leaving the field completes an unfinished time', () => {
  assert.equal(finishTime('8'), '08:00');
  assert.equal(finishTime('08:'), '08:00');
  assert.equal(finishTime('12:3'), '12:30');
  assert.equal(finishTime(''), '');
  assert.equal(validTime(finishTime('21:4')), true);
  assert.equal(validTime('24:00'), false);
});

test('the plan time field uses the shared mask', () => {
  const source = readFileSync(new URL('../src/personal.tsx', import.meta.url), 'utf8');
  assert.match(source, /from '\.\/time-mask\.mjs'/);
  assert.match(source, /maskTime\(e\.target\.value,text\)/);
  assert.match(source, /finishTime\(text\)/);
});
