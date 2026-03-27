'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { MouseEvent } from 'react';

export type DragZone = string;

export type UseContainerDragResult = {
  pointer: { x: number; y: number };
  onOverlayMouseMove: (e: MouseEvent<HTMLDivElement>) => void;
  createSlotBinder: (
    zone: DragZone,
    onClick: (index: number, button: 'left' | 'right', shift: boolean) => void,
    onCollect?: (index: number) => void,
  ) => {
    bind: (index: number) => {
      onMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
      onMouseEnter: () => void;
      onDoubleClick: () => void;
      onContextMenu: (e: MouseEvent<HTMLDivElement>) => void;
    };
    dragStart: (index: number, button: 'left' | 'right', shift: boolean) => void;
    dragContinue: (index: number) => void;
  };
};

/**
 * Shared drag/pointer tracking for all container UIs.
 * Manages right-click drag-to-distribute and cursor position.
 */
export function useContainerDrag(): UseContainerDragResult {
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const activeZoneRef = useRef<DragZone | null>(null);
  const dragButtonRef = useRef<'left' | 'right' | null>(null);
  const dragShiftRef = useRef(false);
  const visitedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const endDrag = () => {
      dragButtonRef.current = null;
      dragShiftRef.current = false;
      activeZoneRef.current = null;
      visitedRef.current.clear();
    };
    window.addEventListener('mouseup', endDrag);
    return () => window.removeEventListener('mouseup', endDrag);
  }, []);

  const onOverlayMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    setPointer({ x: e.clientX, y: e.clientY });
  }, []);

  const createSlotBinder = useCallback(
    (
      zone: DragZone,
      onClick: (index: number, button: 'left' | 'right', shift: boolean) => void,
      onCollect?: (index: number) => void,
    ) => {
      const key = (index: number) => `${zone}:${index}`;

      const dragStart = (index: number, button: 'left' | 'right', shift: boolean) => {
        if (button !== 'right' || shift) {
          dragButtonRef.current = null;
          dragShiftRef.current = false;
          activeZoneRef.current = null;
          visitedRef.current.clear();
          return;
        }
        dragButtonRef.current = button;
        dragShiftRef.current = shift;
        activeZoneRef.current = zone;
        visitedRef.current = new Set([key(index)]);
      };

      const dragContinue = (index: number) => {
        const b = dragButtonRef.current;
        if (!b || activeZoneRef.current !== zone) return;
        const k = key(index);
        if (visitedRef.current.has(k)) return;
        visitedRef.current.add(k);
        onClick(index, b, dragShiftRef.current);
      };

      const bind = (index: number) => ({
        onMouseDown: (e: MouseEvent<HTMLDivElement>) => {
          e.preventDefault();
          const button = e.button === 2 ? ('right' as const) : ('left' as const);
          const shift = e.shiftKey;
          onClick(index, button, shift);
          dragStart(index, button, shift);
        },
        onMouseEnter: () => dragContinue(index),
        onDoubleClick: () => onCollect?.(index),
        onContextMenu: (e: MouseEvent<HTMLDivElement>) => e.preventDefault(),
      });

      return { bind, dragStart, dragContinue };
    },
    [],
  );

  return { pointer, onOverlayMouseMove, createSlotBinder };
}
