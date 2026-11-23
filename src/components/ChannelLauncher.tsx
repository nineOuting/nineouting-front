import { useMatch } from 'react-router-dom';
import styles from './ChannelLauncher.module.css';

type ChannelIO = (command: string) => void;

const openMessenger = () => (window as Window & { ChannelIO?: ChannelIO }).ChannelIO?.('showMessenger');

/**
 * 채널톡 상담 버튼 (2026-11-23). 채널톡 기본 버튼은 모양을 바꿀 수 없어 숨기고(hideChannelButtonOnBoot),
 * 랜딩의 TOP 버튼과 같은 모양으로 직접 그린다. 랜딩에서는 TOP 버튼 위에 두고, 회의 중 화면에서는 그리지 않는다
 */
export default function ChannelLauncher() {
  const isLanding = useMatch('/') !== null;
  const isMeetingRoom = useMatch('/meetings/:meetingId/room') !== null;
  if (isMeetingRoom) {
    return null;
  }
  return (
    <button
      type="button"
      className={[styles.launcher, isLanding ? styles.landing : ''].filter(Boolean).join(' ')}
      aria-label="채널톡 상담"
      onClick={openMessenger}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 20.5l1.5-4.6A8.2 8.2 0 0 1 3 11.5 8.6 8.6 0 0 1 12 3a8.6 8.6 0 0 1 9 8.5z" />
      </svg>
      <span>문의</span>
    </button>
  );
}
