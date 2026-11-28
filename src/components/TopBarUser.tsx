import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { getUnreadCount } from '../api/notification';
import { getMe, ME_CHANGED_EVENT, peekMe, type Me } from '../api/user';
import logoutIcon from '../assets/icons/logout.svg';
import displayIcon from '../assets/icons/display.svg';
import notificationsIcon from '../assets/icons/notifications.svg';
import personIcon from '../assets/icons/person.svg';
import { useSettingsModal, type SettingsTab } from '../pages/settings/useSettingsModal';
import Avatar from './Avatar';
import Icon from './Icon';
import menu from './Menu.module.css';
import NotificationPanel from './NotificationPanel';
import Skeleton from './Skeleton';
import styles from './AppLayout.module.css';

const TOP_ICON_SIZE = 24;
const MENU_ICON_SIZE = 20;
const BADGE_MAX = 99;
// 내 정보를 처음 받는 동안 이름 자리 (디자인 이름 칸 폭 정도)
const NAME_PLACEHOLDER_WIDTH = 48;
const NAME_PLACEHOLDER_HEIGHT = 20;

/** 마지막으로 받은 안 읽은 알림 수. 화면을 옮겨 새로 그릴 때 배지가 사라졌다 다시 나타나지 않게 */
let lastUnread = 0;

/** 상단 바 오른쪽 알림과 프로필 메뉴 (디자인 UserActions). 앱 화면과 회의록, 양식 편집 화면이 함께 쓴다 */
export default function TopBarUser() {
  const navigate = useNavigate();
  // 이미 받은 내 정보로 바로 그린다 (기다리면 프로필이 뒤늦게 나타나 알림 아이콘이 옆으로 밀린다)
  const [me, setMe] = useState<Me | undefined>(peekMe);
  const [unread, setUnread] = useState(lastUnread);
  const [openPanel, setOpenPanel] = useState<'notifications' | 'profile' | null>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const profileRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const closePanel = useCallback(() => setOpenPanel(null), []);
  const settings = useSettingsModal();
  // REQ-003 프로필, 요금제, 화면 설정은 설정 창(REQ-145)의 해당 메뉴로 연다
  const openSettings = (tab: SettingsTab) => {
    closePanel();
    settings.open(tab);
  };

  useEffect(() => {
    let isCurrent = true;
    getMe()
      .then((loaded) => isCurrent && setMe(loaded))
      .catch(() => undefined);
    getUnreadCount()
      .then((count) => {
        lastUnread = count;
        if (isCurrent) {
          setUnread(count);
        }
      })
      .catch(() => undefined);
    // 설정 창에서 사진, 이름을 바꾸면 화면을 옮기지 않아도 바로 반영 (기본 프로필 고르기 포함)
    const reloadMe = () => {
      getMe()
        .then((loaded) => isCurrent && setMe(loaded))
        .catch(() => undefined);
    };
    window.addEventListener(ME_CHANGED_EVENT, reloadMe);
    return () => {
      isCurrent = false;
      window.removeEventListener(ME_CHANGED_EVENT, reloadMe);
    };
  }, []);

  // 프로필 메뉴는 바깥을 누르거나 Esc로 닫는다
  useEffect(() => {
    if (openPanel !== 'profile') {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!profileMenuRef.current?.contains(target) && !profileRef.current?.contains(target)) {
        closePanel();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePanel();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPanel, closePanel]);

  const toggle = (panel: 'notifications' | 'profile') => setOpenPanel((current) => (current === panel ? null : panel));

  // REQ-003 로그아웃
  const signOut = async () => {
    closePanel();
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className={styles.actions}>
      <span className={styles.anchor}>
        <button
          ref={bellRef}
          type="button"
          className={styles.iconButton}
          aria-label={unread > 0 ? `알림 ${unread}개 안 읽음` : '알림'}
          aria-expanded={openPanel === 'notifications'}
          onClick={() => toggle('notifications')}
        >
          <Icon src={notificationsIcon} size={TOP_ICON_SIZE} />
          {unread > 0 && <span className={styles.badge}>{Math.min(unread, BADGE_MAX)}</span>}
        </button>
        {openPanel === 'notifications' && (
          <NotificationPanel anchorRef={bellRef} onUnreadChange={(count) => {
              lastUnread = count;
              setUnread(count);
            }} onClose={closePanel} />
        )}
      </span>
      {/* 처음 받는 동안에는 프로필 버튼과 같은 크기의 자리를 잡아 둔다 */}
      {!me && (
        <span className={styles.profile} aria-hidden="true">
          <Skeleton width="var(--profile-md)" height="var(--profile-md)" className={styles.avatarPlaceholder} />
          <Skeleton width={NAME_PLACEHOLDER_WIDTH} height={NAME_PLACEHOLDER_HEIGHT} />
        </span>
      )}
      {me && (
        <span className={styles.anchor}>
          <button
            ref={profileRef}
            type="button"
            className={styles.profile}
            aria-haspopup="menu"
            aria-expanded={openPanel === 'profile'}
            onClick={() => toggle('profile')}
          >
            <Avatar url={me.profileImageUrl} className={styles.avatar} />
            <span className={styles.name}>{me.name}</span>
          </button>
          {openPanel === 'profile' && (
            <div ref={profileMenuRef} role="menu" aria-label="내 메뉴" className={`${menu.menu} ${styles.profileMenu}`}>
              <div className={styles.profileHeader}>
                <Avatar url={me.profileImageUrl} className={`${styles.avatar} ${styles.menuAvatar}`} />
                <span className={styles.profileTexts}>
                  <span className={styles.profileName}>{me.name}</span>
                  <span className={styles.profileEmail}>{me.email}</span>
                </span>
              </div>
              <div className={menu.divider} />
              <button type="button" role="menuitem" className={menu.item} onClick={() => openSettings('profile')}>
                <Icon src={personIcon} size={MENU_ICON_SIZE} className={menu.itemIcon} />
                프로필
              </button>
              {/* 요금제는 프로필 메뉴에서 뺐다 (디자인 체크 2026-11-19). 설정 창의 요금제 메뉴로 본다 */}
              <button type="button" role="menuitem" className={menu.item} onClick={() => openSettings('display')}>
                {/* 디자인 Card 프로필 메뉴 (11/17 변경): 화면 아이콘 */}
                <Icon src={displayIcon} size={MENU_ICON_SIZE} className={menu.itemIcon} />
                화면
              </button>
              <div className={menu.divider} />
              <button type="button" role="menuitem" className={menu.item} onClick={signOut}>
                <Icon src={logoutIcon} size={MENU_ICON_SIZE} className={menu.itemIcon} />
                로그아웃
              </button>
            </div>
          )}
        </span>
      )}
    </div>
  );
}
