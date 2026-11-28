import { useEffect } from 'react';
import { matchPath, useLocation } from 'react-router-dom';

type ChannelIO = (command: string) => void;

const channelIO = (command: string) => (window as Window & { ChannelIO?: ChannelIO }).ChannelIO?.(command);

/** 채널톡 버튼을 숨길 화면: 회의 중, 회의록 편집, 회의록 양식 편집 (버튼이 편집 영역, 회의 조작을 가린다), 관리자 화면 */
const HIDDEN_PATHS = [
  '/admin',
  '/meetings/:meetingId/room',
  '/meetings/:meetingId/minutes',
  '/templates/new',
  '/templates/:templateId/edit',
];

/**
 * 채널톡 원래 버튼은 모든 화면에 뜨고(index.html boot), HIDDEN_PATHS 화면에서만 숨긴다
 * (2026-11-23 회의 중, 2026-11-27 회의록 편집, 양식 편집, 2026-11-28 관리자 화면 추가).
 * 랜딩의 TOP 버튼은 landing.html에서 이 버튼 위로 올려 두었다
 */
export default function ChannelLauncher() {
  const { pathname } = useLocation();
  const hidden = HIDDEN_PATHS.some((pattern) => matchPath(pattern, pathname) !== null);
  useEffect(() => {
    channelIO(hidden ? 'hideChannelButton' : 'showChannelButton');
  }, [hidden]);
  return null;
}
