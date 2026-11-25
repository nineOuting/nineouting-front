import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';

// 순서를 바꾼 뒤 다른 줄이 새 자리로 미끄러지는 시간 (양식 편집 미리보기와 같다)
const MOVE_MS = 200;

/** 손잡이로 끄는 중인 줄. tops, heights는 끌기 시작할 때 화면 위치 (px) */
interface DragState {
  group: string;
  from: number;
  to: number;
  startY: number;
  dy: number;
  tops: number[];
  heights: number[];
  /** 줄 사이 거리 (끄는 줄 높이 + 간격): 비켜 주는 줄이 이만큼 움직인다 */
  step: number;
}

/**
 * 끌어서 순서 바꾸기 (양식 편집 미리보기와 같은 방식, SCRUM-410).
 * 브라우저 끌기 이미지 대신 끄는 줄 자체가 마우스를 따라오고, 사이에 낀 줄은 자리를 비켜 준다.
 * 놓으면 순서를 바꾸고 줄마다 원래 자리에서 새 자리로 미끄러진다. 손잡이에서 ↑↓로도 옮긴다.
 * group으로 여러 목록(안건, 안건마다 결정할 사항)을 따로 끈다. 다른 목록으로는 옮기지 않는다
 */
export function useSortableDrag(onMove: (group: string, from: number, to: number) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const rowsRef = useRef(new Map<string, HTMLElement>());
  // 순서를 바꾸기 직전 줄 위치 (움직임을 그리려고)
  const flipRef = useRef<{ group: string; tops: number[]; order: number[] } | null>(null);

  const keyOf = (group: string, index: number) => `${group}:${index}`;
  const rowsOf = (group: string) => {
    const rows: HTMLElement[] = [];
    for (let index = 0; rowsRef.current.has(keyOf(group, index)); index += 1) {
      rows.push(rowsRef.current.get(keyOf(group, index)) as HTMLElement);
    }
    return rows;
  };

  // 순서를 바꾼 뒤 줄마다 원래 자리에서 새 자리로 움직인다
  useLayoutEffect(() => {
    const flip = flipRef.current;
    if (!flip) {
      return;
    }
    flipRef.current = null;
    rowsOf(flip.group).forEach((row, index) => {
      const before = flip.tops[flip.order[index]];
      if (before === undefined) {
        return;
      }
      const dy = before - row.getBoundingClientRect().top;
      if (Math.abs(dy) > 1) {
        row.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: MOVE_MS, easing: 'ease-out' });
      }
    });
  });

  const commit = (group: string, from: number, to: number) => {
    const rows = rowsOf(group);
    const order = rows.map((_, index) => index);
    const [moved] = order.splice(from, 1);
    order.splice(to, 0, moved);
    flipRef.current = { group, tops: rows.map((row) => row.getBoundingClientRect().top), order };
    onMove(group, from, to);
  };

  /** 줄 요소를 알려 준다 (위치를 재려고) */
  const register = (group: string, index: number) => (element: HTMLElement | null) => {
    const key = keyOf(group, index);
    if (element) {
      rowsRef.current.set(key, element);
    } else {
      rowsRef.current.delete(key);
    }
  };

  /** 손잡이에 붙일 이벤트 */
  const handleProps = (group: string, index: number) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const rects = rowsOf(group).map((row) => row.getBoundingClientRect());
      const own = rects[index];
      const next = rects[index + 1] ?? rects[index - 1];
      const gap = next ? Math.abs(next.top - own.top) - (next.top > own.top ? own.height : next.height) : 0;
      setDrag({
        group,
        from: index,
        to: index,
        startY: event.clientY,
        dy: 0,
        tops: rects.map((rect) => rect.top),
        heights: rects.map((rect) => rect.height),
        step: own ? own.height + Math.max(0, gap) : 0,
      });
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      if (!drag || drag.group !== group) {
        return;
      }
      const dy = event.clientY - drag.startY;
      const center = drag.tops[drag.from] + dy + drag.heights[drag.from] / 2;
      // 끄는 줄 가운데보다 위에 가운데가 있는 다른 줄 수가 새 자리
      const to = drag.tops.filter((top, position) => position !== drag.from && top + drag.heights[position] / 2 < center).length;
      setDrag({ ...drag, dy, to });
    },
    onPointerUp: () => {
      if (drag && drag.group === group && drag.to !== drag.from) {
        onMove(group, drag.from, drag.to);
      }
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      const count = rowsOf(group).length;
      if (event.key === 'ArrowUp' && index > 0) {
        event.preventDefault();
        commit(group, index, index - 1);
      } else if (event.key === 'ArrowDown' && index < count - 1) {
        event.preventDefault();
        commit(group, index, index + 1);
      }
    },
  });

  /** 끄는 동안 줄마다 옮겨 보일 거리 (px) */
  const offsetOf = (group: string, index: number) => {
    if (!drag || drag.group !== group) {
      return 0;
    }
    if (index === drag.from) {
      return drag.dy;
    }
    if (drag.from < drag.to && index > drag.from && index <= drag.to) {
      return -drag.step;
    }
    if (drag.to < drag.from && index >= drag.to && index < drag.from) {
      return drag.step;
    }
    return 0;
  };

  return {
    register,
    handleProps,
    offsetOf,
    /** 이 줄을 끄는 중인지 */
    isDragging: (group: string, index: number) => drag?.group === group && drag.from === index,
    /** 이 목록에서 다른 줄을 끄는 중인지 (비켜 주는 줄은 부드럽게 움직인다) */
    isMakingRoom: (group: string, index: number) => drag?.group === group && drag.from !== index,
  };
}
