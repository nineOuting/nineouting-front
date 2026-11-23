import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { listFavorites, setFavorite } from '../api/workspace';
import starFillIcon from '../assets/icons/star-fill.svg';
import starOutlineIcon from '../assets/icons/star-outline.svg';
import Icon from './Icon';
import styles from './FavoriteButton.module.css';

const STAR_SIZE = 20;

interface FavoriteButtonProps {
  target: { type: 'workspace'; workspaceId: number } | { type: 'folder'; workspaceId: number; folderId: number };
  name: string;
  onError: (message: string) => void;
  /** 부모가 즐겨찾기 상태를 가질 때 (폴더 카드 ⋮ 메뉴와 별이 같은 상태를 쓴다). 없으면 스스로 불러온다 */
  isFavorite?: boolean;
  onChange?: (isFavorite: boolean) => void;
}

/** REQ-153 워크스페이스·폴더 즐겨찾기 등록·해제. 안 한 상태는 속이 빈 회색 별, 한 상태는 노란 별 */
export default function FavoriteButton({ target, name, onError, isFavorite: controlled, onChange }: FavoriteButtonProps) {
  const [loaded, setIsFavorite] = useState(false);
  const isFavorite = controlled ?? loaded;
  const [isSaving, setIsSaving] = useState(false);
  const targetId = target.type === 'folder' ? target.folderId : target.workspaceId;

  useEffect(() => {
    if (controlled !== undefined) {
      return;
    }
    let isCurrent = true;
    listFavorites()
      .then((items) => {
        if (isCurrent) {
          setIsFavorite(
            items.some((item) =>
              target.type === 'folder' ? item.folderId === targetId : item.type === 'workspace' && item.workspaceId === targetId,
            ),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      isCurrent = false;
    };
  }, [controlled, target.type, targetId]);

  const toggle = async () => {
    setIsSaving(true);
    try {
      await setFavorite(target, !isFavorite);
      setIsFavorite(!isFavorite);
      onChange?.(!isFavorite);
    } catch (error) {
      onError(errorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <button
      type="button"
      className={[styles.button, isFavorite ? styles.on : ''].filter(Boolean).join(' ')}
      aria-label={`${name} 즐겨찾기`}
      aria-pressed={isFavorite}
      disabled={isSaving}
      onClick={toggle}
    >
      <Icon src={isFavorite ? starFillIcon : starOutlineIcon} size={STAR_SIZE} />
    </button>
  );
}
