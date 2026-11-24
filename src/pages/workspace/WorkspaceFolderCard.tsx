import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import clockIcon from '../../assets/icons/clock.svg';
import folderIcon from '../../assets/icons/folder-md.svg';
import lockIcon from '../../assets/icons/lock.svg';
import AvatarStack from '../../components/AvatarStack';
import FavoriteButton from '../../components/FavoriteButton';
import Icon from '../../components/Icon';
import type { Member } from '../../types/meeting';
import type { FolderSummary } from '../../types/workspace';
import { folderBorderColor, folderIconColor, folderSubtleColor } from '../../utils/folderColor';
import { formatMeetingDate } from '../../utils/meetingFormat';
import styles from './WorkspaceFolderCard.module.css';

const ICON_SIZE = 20;
const TIME_ICON_SIZE = 14;
const AVATAR_MAX = 4;

/** 폴더 카드 아래 줄: 다음 예정 회의가 있으면 그 시각, 없으면 마지막 회의 날짜 */
export interface FolderActivity {
  next?: string;
  last?: string;
}

interface WorkspaceFolderCardProps {
  folder: FolderSummary;
  workspaceId: number;
  activity?: FolderActivity;
  members: Member[];
  /** ⋮ 더보기 메뉴 */
  menu: ReactNode;
  onError: (text: string) => void;
  /** ⋮ [즐겨찾기에 추가]와 같은 상태 */
  isFavorite: boolean;
  onFavoriteChange: (isFavorite: boolean) => void;
}

/** 2026-11-18T14:00:00 → 11.18(화) 14:00, 2026-10-30 → 10.30(목) */
function shortDate(value: string, withTime: boolean) {
  const date = formatMeetingDate(value.slice(0, 10)).slice(5);
  return withTime ? `${date} ${value.slice(11, 16)}` : date;
}

/**
 * REQ-037~038 피그마 Page 8 FolderCard: 프로젝트 색 카드(REQ-202). 이름, 회의 수, ⋮, 즐겨찾기,
 * 다음 회의(없으면 마지막 회의), 멤버 얼굴. 카드를 누르면 폴더로 간다
 */
export default function WorkspaceFolderCard({
  folder,
  workspaceId,
  activity,
  members,
  menu,
  onError,
  isFavorite,
  onFavoriteChange,
}: WorkspaceFolderCardProps) {
  const navigate = useNavigate();
  // 들어갈 수 없는 폴더도 누르면 폴더 화면으로 가서 "이 폴더는 볼 수 없어요" 안내를 본다 (2026-11-24 QA)
  const open = () => navigate(`/folders/${folder.folderId}`);
  const isLocked = folder.accessible === false;

  return (
    <li
      className={styles.card}
      style={{ background: folderSubtleColor(folder.color), borderColor: folderBorderColor(folder.color) }}
    >
      <div className={styles.top}>
        <span className={styles.icon} style={{ color: folderIconColor(folder.color) }}>
          <Icon src={folderIcon} size={ICON_SIZE} />
        </span>
        <button type="button" className={styles.titleGroup} onClick={open}>
          <span className={styles.name}>{folder.name}</span>
          {isLocked ? (
            <span className={`${styles.count} ${styles.locked}`}>
              <Icon src={lockIcon} size={TIME_ICON_SIZE} />
              초대받은 멤버만 볼 수 있어요
            </span>
          ) : (
            <span className={styles.count}>회의 {folder.meetingCount}개</span>
          )}
        </button>
        {/* 들어갈 수 없는 폴더는 메뉴, 즐겨찾기를 숨긴다 */}
        {!isLocked && (
        <span className={styles.actions}>
          {menu}
          <FavoriteButton
            target={{ type: 'folder', workspaceId, folderId: folder.folderId }}
            name={folder.name}
            onError={onError}
            isFavorite={isFavorite}
            onChange={onFavoriteChange}
          />
        </span>
        )}
      </div>
      <div className={styles.divider} style={{ background: folderBorderColor(folder.color) }} />
      {!isLocked && (
      <button type="button" className={styles.meta} onClick={open}>
        <span className={styles.activity}>
          <Icon src={clockIcon} size={TIME_ICON_SIZE} />
          {activity?.next
            ? `다음 회의 ${shortDate(activity.next, true)}`
            : activity?.last
              ? `마지막 회의 ${shortDate(activity.last, false)}`
              : '아직 회의가 없어요'}
        </span>
        {members.length > 0 && <AvatarStack members={members} max={AVATAR_MAX} label={`폴더 멤버 ${members.length}명`} />}
      </button>
      )}
    </li>
  );
}
