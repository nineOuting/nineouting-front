import { Link } from 'react-router-dom';
import dividerHomeFavorites from '../../assets/divider-home-favorites.svg';
import dotFavorite from '../../assets/dot-favorite.svg';
import Placeholder from '../../components/Placeholder';
import type { Favorite } from '../../types/workspace';
import card from './HomeCard.module.css';
import styles from './FavoritesCard.module.css';

const ICON_SIZE = 26;
const ITEM_ICON_SIZE = 24;
const STAR_ICON_SIZE = 16;
const DOT_SIZE = 5;
const DIVIDER_WIDTH = 1124;

interface FavoritesCardProps {
  items: Favorite[];
  onRemove: (favorite: Favorite) => void;
}

const favoritePath = (favorite: Favorite) =>
  favorite.type === 'folder' ? `/folders/${favorite.folderId}` : `/workspaces/${favorite.workspaceId}`;

/** REQ-143~144 즐겨찾기한 워크스페이스·폴더. 별을 누르면 즐겨찾기에서 뺀다 */
export default function FavoritesCard({ items, onRemove }: FavoritesCardProps) {
  return (
    <section className={`${card.card} ${styles.card}`} aria-labelledby="favorites-title">
      <div className={card.head}>
        <h2 id="favorites-title" className={card.title}>
          <Placeholder size={ICON_SIZE} />
          즐겨찾기
        </h2>
      </div>
      <img src={dividerHomeFavorites} alt="" width={DIVIDER_WIDTH} height={1} className={card.divider} />
      {items.length === 0 ? (
        <p className={styles.empty}>워크스페이스나 폴더 화면에서 별을 눌러 즐겨찾기에 추가해 보세요.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((favorite) => {
            const name = favorite.type === 'folder' ? favorite.folderName : favorite.workspaceName;
            return (
              <li key={`${favorite.type}-${favorite.folderId ?? favorite.workspaceId}`} className={styles.item}>
                <Link to={favoritePath(favorite)} className={styles.link}>
                  <Placeholder size={ITEM_ICON_SIZE} />
                  <span className={styles.texts}>
                    <span className={styles.name}>{name}</span>
                    <span className={styles.kind}>
                      {favorite.type === 'folder' ? (
                        <>
                          폴더
                          <img src={dotFavorite} alt="" width={DOT_SIZE} height={DOT_SIZE} />
                          <span className={styles.ellipsis}>{favorite.workspaceName}</span>
                        </>
                      ) : (
                        '워크스페이스'
                      )}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  className={card.iconButton}
                  aria-label={`${name} 즐겨찾기 해제`}
                  onClick={() => onRemove(favorite)}
                >
                  <Placeholder size={STAR_ICON_SIZE} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
