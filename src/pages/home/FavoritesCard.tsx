import { Link } from 'react-router-dom';
import folderIcon from '../../assets/icons/folder-md.svg';
import starIcon from '../../assets/icons/star-fill.svg';
import workspaceIcon from '../../assets/icons/workspace.svg';
import type { Favorite } from '../../types/workspace';
import card from './HomeCard.module.css';
import styles from './FavoritesCard.module.css';

const ICON_SIZE = 20;

interface FavoritesCardProps {
  items: Favorite[];
  onRemove: (favorite: Favorite) => void;
}

const favoritePath = (favorite: Favorite) =>
  favorite.type === 'folder' ? `/folders/${favorite.folderId}` : `/workspaces/${favorite.workspaceId}`;

/** REQ-151~153 즐겨찾기한 워크스페이스, 폴더. 별을 누르면 즐겨찾기에서 뺀다 */
export default function FavoritesCard({ items, onRemove }: FavoritesCardProps) {
  return (
    <section className={card.card} aria-labelledby="favorites-title">
      <div className={card.head}>
        <h2 id="favorites-title" className={card.title}>
          즐겨찾기
        </h2>
      </div>
      {items.length === 0 ? (
        <p className={card.secondary}>워크스페이스나 폴더 화면에서 별을 눌러 즐겨찾기에 추가해 보세요.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((favorite) => {
            const isFolder = favorite.type === 'folder';
            const name = isFolder ? favorite.folderName : favorite.workspaceName;
            return (
              <li key={`${favorite.type}-${favorite.folderId ?? favorite.workspaceId}`} className={styles.item}>
                <div className={styles.header}>
                  <span className={styles.iconBox}>
                    <img src={isFolder ? folderIcon : workspaceIcon} alt="" width={ICON_SIZE} height={ICON_SIZE} />
                  </span>
                  <button
                    type="button"
                    className={card.iconButton}
                    aria-label={`${name} 즐겨찾기 해제`}
                    onClick={() => onRemove(favorite)}
                  >
                    <img src={starIcon} alt="" width={ICON_SIZE} height={ICON_SIZE} />
                  </button>
                </div>
                <Link to={favoritePath(favorite)} className={styles.link}>
                  <span className={styles.name}>{name}</span>
                  <span className={card.caption}>{isFolder ? favorite.workspaceName : '워크스페이스'}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
