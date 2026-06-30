/**
 * A requestAnimationFrame loop exposed as a hook.
 *
 * The callback receives a clamped delta in seconds, so all game logic stays
 * frame-rate independent. The latest callback is held in a ref, so the loop is
 * started exactly once and never restarts when the callback identity changes —
 * which is essential to avoid re-subscribing every React render.
 */
import { useEffect, useRef } from 'react';
import {
  MAX_FRAME_DELTA_SECONDS,
  MILLISECONDS_PER_SECOND,
} from '@/engine/constants';

type FrameHandler = (deltaSeconds: number) => void;

export function useAnimationFrame(handler: FrameHandler): void {
  const handlerRef = useRef<FrameHandler>(handler);
  handlerRef.current = handler;

  useEffect(() => {
    let frameId = 0;
    let lastTime = performance.now();

    const loop = (now: number): void => {
      const deltaSeconds = Math.min(
        (now - lastTime) / MILLISECONDS_PER_SECOND,
        MAX_FRAME_DELTA_SECONDS,
      );
      lastTime = now;
      handlerRef.current(deltaSeconds);
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);
}
