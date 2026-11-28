import { useEffect } from 'react';
import { track } from '../utils/track';

/** 그려질 때 화면 열람 이벤트를 한 번 보낸다. 주소가 같은 두 화면(회의 대기, 회의록 확인)을 나누려고 쓴다 */
export default function TrackView({ name }: { name: string }) {
  useEffect(() => {
    track(name);
  }, [name]);
  return null;
}
