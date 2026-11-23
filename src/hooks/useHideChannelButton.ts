import { useEffect } from 'react';

type ChannelIO = (command: string) => void;

function channelIO(command: string) {
  (window as Window & { ChannelIO?: ChannelIO }).ChannelIO?.(command);
}

/** 채널톡 상담 버튼을 이 화면에서만 숨기고, 화면을 떠나면 다시 보인다 (회의 중 화면, 2026-11-23) */
export function useHideChannelButton() {
  useEffect(() => {
    channelIO('hideChannelButton');
    return () => channelIO('showChannelButton');
  }, []);
}
