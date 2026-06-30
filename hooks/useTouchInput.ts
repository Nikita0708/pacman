/**
 * Touch-swipe input hook for mobile.
 *
 * Attaches touch listeners to a canvas/element ref and translates swipe
 * gestures into direction intents. A short tap (no significant movement)
 * fires onConfirm, mirroring the keyboard Enter/Space behaviour.
 *
 * Uses { passive: false } so preventDefault() can suppress page scroll while
 * the player is swiping over the game canvas.
 */
import { useEffect, useRef } from 'react';
import { Direction } from '@/engine/types';
import type { KeyboardHandlers } from './useKeyboard';

const SWIPE_PX = 18; // minimum travel before a direction is committed

export function useTouchInput<T extends HTMLElement>(
  elementRef: React.RefObject<T | null>,
  handlers: KeyboardHandlers,
): void {
  const handlersRef = useRef<KeyboardHandlers>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let fired = false; // one direction intent per touch gesture

    const onTouchStart = (e: TouchEvent): void => {
      e.preventDefault();
      const t = e.touches[0];
      if (!t) return;
      startX = t.clientX;
      startY = t.clientY;
      fired = false;
    };

    const onTouchMove = (e: TouchEvent): void => {
      e.preventDefault();
      if (fired) return;
      const t = e.touches[0];
      if (!t) return;

      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const adx = Math.abs(dx);
      const ady = Math.abs(dy);

      if (adx < SWIPE_PX && ady < SWIPE_PX) return;

      fired = true;
      if (adx >= ady) {
        handlersRef.current.onDirection(dx > 0 ? Direction.RIGHT : Direction.LEFT);
      } else {
        handlersRef.current.onDirection(dy > 0 ? Direction.DOWN : Direction.UP);
      }
    };

    const onTouchEnd = (e: TouchEvent): void => {
      e.preventDefault();
      if (!fired) {
        // Tap with no real movement → confirm (start / toggle pause)
        const t = e.changedTouches[0];
        if (t) {
          const dx = Math.abs(t.clientX - startX);
          const dy = Math.abs(t.clientY - startY);
          if (dx < SWIPE_PX && dy < SWIPE_PX) {
            handlersRef.current.onConfirm();
          }
        }
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [elementRef]); // handlers change identity each render — use ref instead
}
