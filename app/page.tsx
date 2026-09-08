import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  useSyncExternalStore, type AnimationEvent, type PointerEvent,
} from 'react';
import { ArrowRight, BookOpen, List, ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { normalizePage, stepPage, getTurnLayout, swipeDirection } from '@/lib/book-navigation.mjs';
import story from './story.json';

type Turn = { from: number; to: number; id: number };
type ReaderState = { page: number; turn: Turn | null };
type Navigation = { requested: number; animate: boolean };
type Gesture = {
  pointerId: number; x: number; y: number; started: number;
  intent: 'pending' | 'horizontal' | 'vertical';
};

function useMediaQuery(query: string) {
  const subscribe = useCallback((notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener('change', notify);
    return () => media.removeEventListener('change', notify);
  }, [query]);
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

function Paper({ number, className, decorative = false, scrollOffset = 0 }: {
  number: number; className?: string; decorative?: boolean; scrollOffset?: number;
}) {
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (body.current) body.current.scrollTop = scrollOffset; }, [number, scrollOffset]);
  const entry = story.pages[number - 1];
  if (!entry) return null;
  const first = (number - 1) % 10 === 0;
  return <article className={cn('paper', className)} data-book-page={number}
    aria-label={decorative ? undefined : `Page ${number}`} aria-hidden={decorative || undefined}>
    <div className="running-head"><span>{number % 2 === 1 ? 'BEFORE I KNEW YOUR NAME' : entry.title}</span><span aria-hidden="true">✦</span></div>
    <div className={cn('page-writing', first && 'chapter-start')} ref={body}
      tabIndex={decorative ? undefined : 0} role={decorative ? undefined : 'region'}
      aria-label={decorative ? undefined : `Page ${number} text; scroll to read more`}>
      {first && <div className="chapter-heading"><span>CHAPTER {String(entry.chapter).padStart(2, '0')}</span><h2>{entry.title}</h2><div className="chapter-rule" /></div>}
      <div className="story-text">{entry.text.split('\n\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
      {number === 200 && <div className="fin">The end <Heart size={14} /></div>}
    </div>
    <div className="folio"><span aria-hidden="true">—</span> {number} <span aria-hidden="true">—</span></div>
  </article>;
}

export default function Home() {
  const singlePage = useMediaQuery('(max-width: 760px)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [reader, setReader] = useState<ReaderState>({ page: 0, turn: null });
  const stateRef = useRef(reader);
  const queued = useRef<Navigation | null>(null);
  const queuedFrame = useRef<number | null>(null);
  const sequence = useRef(0);
  const [contents, setContents] = useState(false);
  const [jumpDraft, setJumpDraft] = useState<string | null>(null);
  const [error, setError] = useState('');
  const readRef = useRef<HTMLElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const savedScroll = useRef(new Map<number, number>());
  const openFocus = useRef(false);
  const previousMedia = useRef({ singlePage, reducedMotion });

  const commit = useCallback((value: ReaderState) => {
    stateRef.current = value;
    setReader(value);
  }, []);

  const go = useCallback((requested: number, animate = true) => {
    if (queuedFrame.current !== null) {
      cancelAnimationFrame(queuedFrame.current);
      queuedFrame.current = null;
    }
    const target = normalizePage(requested, singlePage);
    if (target === null) { setError('Choose a page from 1 to 200.'); return; }
    setError('');
    setJumpDraft(null);
    setContents(false);
    const current = stateRef.current;
    if (current.turn && animate) {
      queued.current = { requested: target, animate };
      return;
    }
    queued.current = null;
    const from = current.turn?.to ?? current.page;
    if (from === target && !current.turn) return;
    openFocus.current = from === 0 && target > 0;
    if (animate && !reducedMotion && target > 0 && from !== target) {
      savedScroll.current.clear();
      bookRef.current?.querySelectorAll<HTMLElement>('.open-book > .paper').forEach(paper => {
        const writing = paper.querySelector<HTMLElement>('.page-writing');
        savedScroll.current.set(Number(paper.dataset.bookPage), writing?.scrollTop ?? 0);
      });
      commit({ page: from, turn: { from, to: target, id: ++sequence.current } });
    } else {
      commit({ page: target, turn: null });
    }
  }, [commit, reducedMotion, singlePage]);

  const completeTurn = useCallback((id: number) => {
    const active = stateRef.current.turn;
    if (!active || active.id !== id) return;
    const pending = queued.current;
    queued.current = null;
    commit({ page: active.to, turn: null });
    // A new keyed leaf starts only after the previous leaf has completed.
    if (pending && pending.requested !== active.to) {
      queuedFrame.current = requestAnimationFrame(() => {
        queuedFrame.current = null;
        go(pending.requested, pending.animate);
      });
    }
  }, [commit, go]);

  useLayoutEffect(() => {
    const previous = previousMedia.current;
    previousMedia.current = { singlePage, reducedMotion };
    if (previous.singlePage === singlePage && previous.reducedMotion === reducedMotion) return;
    queued.current = null;
    gesture.current = null;
    if (queuedFrame.current !== null) {
      cancelAnimationFrame(queuedFrame.current);
      queuedFrame.current = null;
    }
    const current = stateRef.current;
    const target = normalizePage(current.turn?.to ?? current.page, singlePage) ?? 0;
    commit({ page: target, turn: null });
  }, [singlePage, reducedMotion, commit]);

  useEffect(() => () => {
    if (queuedFrame.current !== null) cancelAnimationFrame(queuedFrame.current);
  }, []);

  useEffect(() => {
    if (reader.page > 0 && openFocus.current && !reader.turn) {
      openFocus.current = false;
      readRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [reader.page, reader.turn]);

  const step = useCallback((direction: 1 | -1) => {
    const current = stateRef.current;
    const from = current.turn?.to ?? current.page;
    go(stepPage(from, direction, singlePage));
  }, [go, singlePage]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (contents || event.altKey || event.ctrlKey || event.metaKey ||
        target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        step(event.key === 'ArrowRight' ? 1 : -1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contents, step]);

  function startGesture(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary) { gesture.current = null; return; }
    if (event.pointerType === 'mouse' || event.button !== 0 ||
      (event.target as HTMLElement).closest('button, input, a')) return;
    gesture.current = {
      pointerId: event.pointerId, x: event.clientX, y: event.clientY,
      started: event.timeStamp, intent: 'pending',
    };
  }
  function moveGesture(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || active.pointerId !== event.pointerId || active.intent !== 'pending') return;
    const dx = Math.abs(event.clientX - active.x);
    const dy = Math.abs(event.clientY - active.y);
    if (dy > 10 && dy > dx) active.intent = 'vertical';
    else if (dx > 12 && dx > dy * 1.4) {
      active.intent = 'horizontal';
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }
  function endGesture(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    gesture.current = null;
    if (!active || active.pointerId !== event.pointerId || active.intent === 'vertical' ||
      window.getSelection()?.type === 'Range') return;
    const direction = swipeDirection(event.clientX - active.x, event.clientY - active.y,
      event.timeStamp - active.started, event.currentTarget.clientWidth);
    if (direction !== 0) { event.preventDefault(); step(direction); }
  }

  const { page, turn } = reader;
  const displayedPage = turn?.to ?? page;
  const end = singlePage ? displayedPage : Math.min(displayedPage + 1, 200);
  const chapter = story.chapters[Math.floor(Math.max(0, displayedPage - 1) / 10)];
  const opening = turn?.from === 0;
  const layout = turn && !opening ? getTurnLayout(turn.from, turn.to, singlePage) : null;
  const scrollOffset = (number: number) => turn ? savedScroll.current.get(number) ?? 0 : 0;
  const onLeafEnd = (event: AnimationEvent<HTMLElement>) => {
    if (event.target === event.currentTarget && turn) completeTurn(turn.id);
  };

  return <main className={cn('library', page > 0 && 'is-reading', opening && 'cover-is-opening')}>
    <header className="masthead">
      <Button variant="ghost" className="wordmark block h-auto whitespace-normal" onClick={() => go(0, false)} aria-label="Return to book cover">
        a little forever<span>THE SHREYA EDITION</span>
      </Button>
      {page > 0 ? <div className="header-actions">
        <Button variant="ghost" className="quiet-button" aria-label="Book cover" onClick={() => go(0, false)}><BookOpen size={17} /><span>Cover</span></Button>
        <Sheet open={contents} onOpenChange={setContents}>
          <SheetTrigger className="quiet-button" aria-label="Open chapters"><List size={18} /><span>Chapters</span></SheetTrigger>
          <SheetContent className="contents-panel">
            <SheetHeader><SheetTitle className="contents-title">Between the pages</SheetTitle><SheetDescription>20 chapters · Shreya’s story</SheetDescription></SheetHeader>
            <nav className="chapter-list" aria-label="Chapters">
              {story.chapters.map(entry => <Button variant="ghost" key={entry.number}
                className={cn('h-auto whitespace-normal', chapter.number === entry.number && 'selected')}
                onClick={() => go(entry.page, false)} aria-current={chapter.number === entry.number ? 'location' : undefined}>
                <span className="chapter-index">{String(entry.number).padStart(2, '0')}</span><span>{entry.title}</span><span className="chapter-page">{entry.page}</span>
              </Button>)}
            </nav>
          </SheetContent>
        </Sheet>
      </div> : <span className="edition">A story in 200 pages</span>}
    </header>

    {page === 0 ? <div className="cover-stage">
      <div className="cover-intro"><span className="eyebrow">FOR THE HOPELESS ROMANTIC</span>
        <h1>Some stories start<br />before you know<br /><em>their name.</em></h1>
        <p>A little English. Konjam Tamil.<br />And a heart that never saw it coming.</p>
        <Button className="primary h-auto" onClick={() => go(1)} disabled={opening}><BookOpen size={18} />{opening ? 'Opening…' : 'Open the book'}<ArrowRight size={18} /></Button>
        <div className="cover-meta">20 chapters <span>·</span> 200 story pages</div>
      </div>
      <Button variant="ghost" className="closed-book block h-auto whitespace-normal" onClick={() => go(1)}
        aria-label="Open Before I Knew Your Name" aria-busy={opening || undefined} onAnimationEnd={onLeafEnd}>
        <span className="cover-spine" aria-hidden="true" /><span className="cover-pages" aria-hidden="true" />
        <img src="/cover.jpg" alt="The photograph supplied for Shreya’s book cover" draggable={false} />
        <div className="cover-shade" /><div className="cover-type"><span>A LITTLE FOREVER</span><h2>Before I Knew<br /><i>Your Name</i></h2><p>Shreya’s story</p></div>
        <div className="cover-bottom">ONE YEAR APART.<br />A WHOLE STORY BETWEEN.</div>
      </Button>
    </div> : <section className="reader" ref={readRef} tabIndex={-1} aria-label="Book reader">
      <div className="reader-heading"><span>CHAPTER {String(chapter.number).padStart(2, '0')} <span className="heading-dot">/</span> {chapter.title}</span>
        <span className="reading-count" aria-live="polite" aria-atomic="true">{singlePage ? `Page ${displayedPage}` : `Pages ${displayedPage}–${end}`} of 200</span>
      </div>
      <div className={cn('book-scene', singlePage && 'is-single', turn && 'turning')} ref={bookRef}
        onPointerDown={startGesture} onPointerMove={moveGesture} onPointerUp={endGesture}
        onPointerCancel={() => { gesture.current = null; }} onLostPointerCapture={() => { gesture.current = null; }}>
        <div className="open-book" aria-busy={!!turn}>
          <span className="binding-detail" aria-hidden="true" /><span className="page-edge-detail" aria-hidden="true" />
          <Paper number={layout?.left ?? page} className="left-paper" scrollOffset={scrollOffset(layout?.left ?? page)} />
          {!singlePage && <Paper number={layout?.right ?? page + 1} className="right-paper" scrollOffset={scrollOffset(layout?.right ?? page + 1)} />}
          {turn && layout && <div key={turn.id} className={cn('flipping-leaf', layout.direction === 1 ? 'forward' : 'backward')}
            aria-hidden="true" inert onAnimationEnd={onLeafEnd}>
            <Paper number={layout.front} className="leaf-face" decorative scrollOffset={scrollOffset(layout.front)} />
            {layout.back !== null && <Paper number={layout.back} className="leaf-face leaf-back" decorative />}
          </div>}
        </div>
      </div>
      <div className="reader-dock">
        <div className="reader-controls"><Pagination aria-label="Book pages"><PaginationContent className="book-navigation">
          <PaginationItem><Button variant="ghost" className="turn-button" onClick={() => step(-1)} aria-label={displayedPage === 1 ? 'Return to cover' : 'Previous page'}><ChevronLeft size={18} /><span>Previous</span></Button></PaginationItem>
          <PaginationItem><form className="jump-form" noValidate onSubmit={event => {
            event.preventDefault();
            const requested = Number(jumpDraft ?? displayedPage);
            if (!Number.isInteger(requested) || requested < 1 || requested > 200) { setError('Choose a page from 1 to 200.'); return; }
            go(requested, false);
          }}>
            <label htmlFor="page-number">Page</label><input id="page-number" aria-describedby={error ? 'page-error' : undefined} aria-invalid={!!error}
              value={jumpDraft ?? displayedPage} onChange={event => setJumpDraft(event.target.value)} type="number" min="1" max="200" inputMode="numeric" />
            <Button variant="ghost" type="submit" aria-label="Go to page"><ArrowRight size={16} /></Button>
          </form></PaginationItem>
          <PaginationItem><Button variant="ghost" className="turn-button" onClick={() => step(1)} disabled={end === 200} aria-label="Next page"><span>Next</span><ChevronRight size={18} /></Button></PaginationItem>
        </PaginationContent></Pagination></div>
        {error && <p id="page-error" role="alert" className="page-error">{error}</p>}
        <div className="reading-progress" aria-hidden="true"><span style={{ transform: `scaleX(${end / 200})` }} /></div>
        <p className="reader-hint">{singlePage ? 'Swipe sideways to turn · Scroll the page to read' : 'Use ← → to turn · Scroll inside a page to read more'}{end === 200 && <span className="end-note"> · Thank you for reading Shreya’s story.</span>}</p>
      </div>
    </section>}
    <footer className="site-footer"><span>{page ? 'An original work of fiction.' : 'A love story, with a few wrong turns.'}</span><span>Made for someone special ♡</span></footer>
  </main>;
}
