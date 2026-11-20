import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

/** 오른쪽 패널 기본이자 최소 너비 (디자인 Version02 Live 420px) */
export const SIDE_PANEL_MIN_WIDTH = 420;
/** 왼쪽 안건 목록 너비 (MeetingRoomPage.module.css .agendaNav) */
const AGENDA_NAV_WIDTH = 240;
/** 패널을 넓혀도 가운데 안건 영역은 이만큼 남긴다 */
const BOARD_MIN_WIDTH = 480;
/** 키보드 화살표 한 번에 바뀌는 너비 */
const KEY_STEP = 16;

function maxWidth() {
  return Math.max(SIDE_PANEL_MIN_WIDTH, window.innerWidth - AGENDA_NAV_WIDTH - BOARD_MIN_WIDTH);
}

function clamp(width: number) {
  return Math.min(maxWidth(), Math.max(SIDE_PANEL_MIN_WIDTH, Math.round(width)));
}

/**
 * 회의 중 화면 오른쪽 패널 너비 조절 (REQ-213).
 * 패널 왼쪽 테두리를 끌면 너비가 바뀐다. 최소는 420px, 최대는 가운데 영역이 480px 남는 데까지
 */
export function useSidePanelResize() {
  const [width, setWidth] = useState(SIDE_PANEL_MIN_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  // 창을 줄이면 최대 너비도 줄어든다
  useEffect(() => {
    const onResize = () => setWidth((current) => clamp(current));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { startX: event.clientX, startWidth: width };
      setIsResizing(true);
    },
    [width],
  );

  const onPointerMove = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!drag.current) {
      return;
    }
    // 패널이 오른쪽에 있어 왼쪽으로 끌수록 넓어진다
    setWidth(clamp(drag.current.startWidth + drag.current.startX - event.clientX));
  }, []);

  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    if (!drag.current) {
      return;
    }
    drag.current = null;
    setIsResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const delta = event.key === 'ArrowLeft' ? KEY_STEP : -KEY_STEP;
      setWidth((current) => clamp(current + delta));
    }
  }, []);

  return {
    width,
    isResizing,
    handleProps: {
      role: 'separator',
      tabIndex: 0,
      'aria-orientation': 'vertical' as const,
      'aria-label': '오른쪽 패널 너비 조절',
      'aria-valuemin': SIDE_PANEL_MIN_WIDTH,
      'aria-valuenow': width,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onKeyDown,
    },
  };
}
