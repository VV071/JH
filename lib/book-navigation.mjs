/** @typedef {1 | -1} TurnDirection */

/**
 * Resolve a requested story page to the visible page or spread.
 * Page zero is the cover; desktop spreads begin on odd page numbers.
 *
 * @param {number} requested
 * @param {boolean} singlePage
 * @param {number} [total=200]
 * @returns {number | null}
 */
export function normalizePage(requested, singlePage, total = 200) {
  if (!Number.isInteger(requested) || requested < 0 || requested > total) {
    return null;
  }
  if (requested === 0 || singlePage) return requested;
  return requested % 2 === 0 ? requested - 1 : requested;
}

/**
 * Move one page or spread, stopping at the cover and the final story page.
 *
 * @param {number} from
 * @param {TurnDirection} direction
 * @param {boolean} singlePage
 * @param {number} [total=200]
 * @returns {number}
 */
export function stepPage(from, direction, singlePage, total = 200) {
  const lastPage = singlePage || total % 2 !== 0 ? total : total - 1;
  const current = Math.max(0, Math.min(from, lastPage));
  if (current === 0) return direction === 1 ? Math.min(1, total) : 0;
  const start = singlePage || current % 2 !== 0 ? current : current - 1;
  return Math.max(0, Math.min(start + direction * (singlePage ? 1 : 2), lastPage));
}

/**
 * Choose the stationary and moving faces for a page turn. On phones a single
 * sheet covers the next page; on desktop its two faces turn across the binding.
 *
 * @param {number} from
 * @param {number} to
 * @param {boolean} singlePage
 * @returns {{left: number, right: number | null, front: number, back: number | null, direction: TurnDirection}}
 */
export function getTurnLayout(from, to, singlePage) {
  const direction = to > from ? 1 : -1;
  if (singlePage) {
    return {
      left: direction === 1 ? to : from,
      right: null,
      front: direction === 1 ? from : to,
      back: null,
      direction,
    };
  }
  return direction === 1
    ? { left: from, right: to + 1, front: from + 1, back: to, direction }
    : { left: to, right: from + 1, front: from, back: to + 1, direction };
}

/**
 * Recognize intentional horizontal drags while leaving vertical reading scroll
 * alone. A short fast flick is accepted as well as a longer slow drag.
 *
 * @param {number} dx
 * @param {number} dy
 * @param {number} elapsedMs
 * @param {number} width
 * @returns {TurnDirection | 0}
 */
export function swipeDirection(dx, dy, elapsedMs, width) {
  if (![dx, dy, elapsedMs, width].every(Number.isFinite)) return 0;
  const distance = Math.abs(dx);
  if (distance === 0 || distance < Math.abs(dy) * 1.4) return 0;
  const threshold = Math.min(72, Math.max(44, width * 0.14));
  const fastFlick = distance >= 28 && distance / Math.max(elapsedMs, 1) >= 0.45;
  if (distance < threshold && !fastFlick) return 0;
  return dx < 0 ? 1 : -1;
}
