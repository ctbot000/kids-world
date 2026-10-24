// The 📰 What's new list (news.js): its updates, and which are new to you.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latestNews, NEWS, newsSince } from '../public/js/news.js';

test('every update has an id of its own, a date, an icon, a title and a text, newest first', () => {
  assert.equal(new Set(NEWS.map((n) => n.id)).size, NEWS.length);
  for (const n of NEWS) {
    assert.match(n.date, /^\d{4}-\d{2}-\d{2}$/, n.id);
    for (const k of ['icon', 'title', 'text']) assert.ok(n[k], `${n.id} ${k}`);
  }
  const dates = NEWS.map((n) => n.date);
  assert.deepEqual(dates, [...dates].sort().reverse());
});

test('newsSince gives the updates after the one seen, and all of them for one it does not know', () => {
  assert.equal(latestNews(), NEWS[0].id);
  assert.deepEqual(newsSince(latestNews()), []);
  assert.deepEqual(newsSince(NEWS[2].id), NEWS.slice(0, 2));
  assert.deepEqual(newsSince('gone'), NEWS);
  assert.deepEqual(newsSince(null), NEWS);
});
