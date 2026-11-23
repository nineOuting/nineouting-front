import { useEffect } from 'react';
import { useMatch } from 'react-router-dom';

type ChannelIO = (command: string) => void;

const channelIO = (command: string) => (window as Window & { ChannelIO?: ChannelIO }).ChannelIO?.(command);

/**
 * 채널톡 원래 버튼은 모든 화면에 뜨고(index.html boot), 회의 중 화면에서만 숨긴다 (2026-11-23).
 * 랜딩의 TOP 버튼은 landing.html에서 이 버튼 위로 올려 두었다
 */
export default function ChannelLauncher() {
  const isMeetingRoom = useMatch('/meetings/:meetingId/room') !== null;
  useEffect(() => {
    channelIO(isMeetingRoom ? 'hideChannelButton' : 'showChannelButton');
  }, [isMeetingRoom]);
  return null;
}
