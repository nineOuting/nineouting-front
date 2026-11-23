import { useState } from 'react';
import { Link } from 'react-router-dom';
import folderIcon from '../../assets/icons/folder-md.svg';
import starIcon from '../../assets/icons/star-fill.svg';
import starOutlineIcon from '../../assets/icons/star-outline.svg';
import workspaceIcon from '../../assets/icons/nav-workspace.svg';
import Icon from '../../components/Icon';
import type { Favorite } from '../../types/workspace';
import { folderIconColor, folderSubtleColor } from '../../utils/folderColor';
import card from './HomeCard.module.css';
import styles from './FavoritesCard.module.css';

const ICON_SIZE = 20;
// 처음에는 3개만 보이고 [전체보기]로 모두 펼친다
const PREVIEW_COUNT = 3;

interface FavoritesCardProps {
  items: Favorite[];
  onRemove: (favorite: Favorite) => void;
}

const favoritePath = (favorite: Favorite) =>
  favorite.type === 'folder' ? `/folders/${favorite.folderId}` : `/workspaces/${favorite.workspaceId}`;

/**
 * REQ-151~153 즐겨찾기한 워크스페이스, 폴더 (피그마 Page 8 FavoritesSection).
 * 폴더 아이콘은 프로젝트 색(REQ-202). 별을 누르면 즐겨찾기에서 뺀다
 */
export default function FavoritesCard({ items, onRemove }: FavoritesCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shown = isExpanded ? items : items.slice(0, PREVIEW_COUNT);

  return (
    <section className={card.section} aria-labelledby="favorites-title">
      <div className={card.sectionHead}>
        <h2 id="favorites-title" className={card.title}>
          즐겨찾기
        </h2>
        {/* 피그마 HomePage_v6: 즐겨찾기가 있으면 [전체보기]를 늘 보여 준다 */}
        {items.length > 0 && (
          <button type="button" className={card.textButton} onClick={() => setIsExpanded((value) => !value)}>
            {isExpanded ? '접기' : '전체보기'}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        // 디자인 EmptyFavorites: 아이콘, 제목, 설명을 가운데에
        <div className={`${card.listBox} ${styles.empty}`}>
          <Icon src={starOutlineIcon} size={20} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>아직 즐겨찾기가 없어요</p>
          <p className={styles.emptyDescription}>폴더에 별을 누르면 여기 모아 둘게요.</p>
        </div>
      ) : (
        <ul className={card.listBox}>
          {shown.map((favorite) => {
            const isFolder = favorite.type === 'folder';
            const name = isFolder ? favorite.folderName : favorite.workspaceName;
            return (
              <li key={`${favorite.type}-${favorite.folderId ?? favorite.workspaceId}`} className={styles.item}>
                <Link to={favoritePath(favorite)} className={styles.link}>
                  <span
                    className={styles.iconBox}
                    style={
                      isFolder
                        ? { background: folderSubtleColor(favorite.folderColor), color: folderIconColor(favorite.folderColor) }
                        : undefined
                    }
                  >
                    <Icon src={isFolder ? folderIcon : workspaceIcon} size={ICON_SIZE} />
                  </span>
                  <span className={styles.texts}>
                    <span className={card.rowTitle}>{name}</span>
                    <span className={card.rowCaption}>{isFolder ? favorite.workspaceName : '워크스페이스'}</span>
                  </span>
                </Link>
                <button
                  type="button"
                  className={styles.star}
                  aria-label={`${name} 즐겨찾기 해제`}
                  onClick={() => onRemove(favorite)}
                >
                  <Icon src={starIcon} size={ICON_SIZE} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
