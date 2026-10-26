import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client';
import { listFavorites, setFavorite } from '../api/workspace';
import starIcon from '../assets/star.svg';
import styles from './FavoriteButton.module.css';

const STAR_SIZE = 20;

interface FavoriteButtonProps {
  target: { type: 'workspace'; workspaceId: number } | { type: 'folder'; workspaceId: number; folderId: number };
  name: string;
  onError: (message: string) => void;
}

/** REQ-144 워크스페이스·폴더 즐겨찾기 등록·해제. 디자인이 없어 회의록 양식 즐겨찾기 별을 따랐다 */
export default function FavoriteButton({ target, name, onError }: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const targetId = target.type === 'folder' ? target.folderId : target.workspaceId;

  useEffect(() => {
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
  }, [target.type, targetId]);

  const toggle = async () => {
    setIsSaving(true);
    try {
      await setFavorite(target, !isFavorite);
      setIsFavorite(!isFavorite);
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
      <img src={starIcon} alt="" width={STAR_SIZE} height={STAR_SIZE} />
    </button>
  );
}
