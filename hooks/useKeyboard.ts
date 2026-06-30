/**
 * Keyboard input hook.
 *
 * Translates physical keys (via `KeyboardEvent.code`, so layout-independent)
 * into high-level intents: change direction, toggle pause, or confirm. It owns
 * no game state — it just forwards intents to the engine. Handlers are kept in
 * a ref so the listener is attached only once.
 */
import { useEffect, useRef } from 'react';
import { CONFIRM_KEYS, KEY_DIRECTION_MAP, PAUSE_KEYS } from '@/engine/constants';
import type { Direction } from '@/engine/types';

export interface KeyboardHandlers {
  onDirection: (direction: Direction) => void;
  onTogglePause: () => void;
  onConfirm: () => void;
}

export function useKeyboard(handlers: KeyboardHandlers): void {
  const handlersRef = useRef<KeyboardHandlers>(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const direction = KEY_DIRECTION_MAP[event.code];
      if (direction !== undefined) {
        event.preventDefault();
        handlersRef.current.onDirection(direction);
        return;
      }
      if (PAUSE_KEYS.has(event.code)) {
        event.preventDefault();
        handlersRef.current.onTogglePause();
        return;
      }
      if (CONFIRM_KEYS.has(event.code)) {
        event.preventDefault();
        handlersRef.current.onConfirm();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
