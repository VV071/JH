import assert from 'node:assert/strict';
import {
  getTurnLayout,
  normalizePage,
  stepPage,
  swipeDirection,
} from '../lib/book-navigation.mjs';

const totalPages = 200;

// Every story page remains reachable in both reading layouts, in either direction.
for (const singlePage of [true, false]) {
  const last = singlePage ? totalPages : totalPages - 1;
  const expectedPages = Array.from({ length: totalPages }, (_, index) => index + 1);
  const forwardPages = new Set();
  const forwardStops = [0];
  let current = 0;
  while (current < last) {
    const next = stepPage(current, 1, singlePage);
    assert.ok(next > current, 'Forward navigation must make progress.');
    current = next;
    forwardStops.push(current);
    forwardPages.add(current);
    if (!singlePage) forwardPages.add(current + 1);
  }
  assert.deepEqual([...forwardPages], expectedPages);
  assert.equal(stepPage(current, 1, singlePage), last);

  const backwardPages = new Set();
  const backwardStops = [last];
  while (current > 0) {
    backwardPages.add(current);
    if (!singlePage) backwardPages.add(current + 1);
    const previous = stepPage(current, -1, singlePage);
    assert.ok(previous < current, 'Backward navigation must make progress.');
    current = previous;
    backwardStops.push(current);
  }
  assert.deepEqual([...backwardPages].sort((a, b) => a - b), expectedPages);
  assert.deepEqual(backwardStops, [...forwardStops].reverse());
  assert.equal(stepPage(0, -1, singlePage), 0);
  assert.equal(stepPage(0, 1, singlePage), 1);
  assert.equal(stepPage(1, -1, singlePage), 0);

  for (const page of expectedPages) {
    assert.equal(normalizePage(page, singlePage), singlePage || page % 2 ? page : page - 1);
  }
  for (const invalid of [-1, 201, 1.5, Number.NaN, Infinity, -Infinity]) {
    assert.equal(normalizePage(invalid, singlePage), null);
  }
  assert.equal(normalizePage(0, singlePage), 0);
}

// The name-reveal boundary advances without skipping or repeating pages.
assert.equal(stepPage(99, 1, false), 101);
assert.equal(stepPage(101, -1, false), 99);
assert.equal(stepPage(100, 1, true), 101);
assert.equal(stepPage(101, -1, true), 100);
assert.equal(normalizePage(200, true), 200);
assert.equal(normalizePage(200, false), 199);
assert.equal(stepPage(199, 1, true), 200);
assert.equal(stepPage(197, 1, false), 199);

assert.deepEqual(getTurnLayout(99, 101, false), {
  left: 99, right: 102, front: 100, back: 101, direction: 1,
});
assert.deepEqual(getTurnLayout(101, 99, false), {
  left: 99, right: 102, front: 101, back: 100, direction: -1,
});
assert.deepEqual(getTurnLayout(100, 101, true), {
  left: 101, right: null, front: 100, back: null, direction: 1,
});
assert.deepEqual(getTurnLayout(101, 100, true), {
  left: 101, right: null, front: 100, back: null, direction: -1,
});

// A reading scroll or tiny movement cannot accidentally turn the page.
assert.equal(swipeDirection(-80, 100, 250, 390), 0);
assert.equal(swipeDirection(-40, 30, 50, 390), 0);
assert.equal(swipeDirection(-20, 0, 20, 390), 0);
assert.equal(swipeDirection(-35, 1, 150, 390), 0);
assert.equal(swipeDirection(0, 0, 0, 390), 0);
assert.equal(swipeDirection(Number.NaN, 0, 100, 390), 0);
assert.equal(swipeDirection(-60, 10, 400, 390), 1);
assert.equal(swipeDirection(60, 10, 400, 390), -1);
assert.equal(swipeDirection(-28, 0, 60, 390), 1);
assert.equal(swipeDirection(28, 0, 60, 390), -1);
assert.equal(swipeDirection(-28, 0, 0, 390), 1);
assert.equal(swipeDirection(-44, 0, 400, 280), 1);
assert.equal(swipeDirection(-43, 0, 400, 280), 0);
assert.equal(swipeDirection(-72, 0, 400, 1200), 1);
assert.equal(swipeDirection(-71, 0, 400, 1200), 0);

console.log('Reader checks passed: all 200 pages, both layouts, turn faces, reveal boundary, and swipe gestures.');
