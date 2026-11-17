import { useNavigate } from 'react-router-dom';
import { listMyWorkspaces } from '../api/workspace';
import type { AccessNoticeKind } from '../utils/accessNotice';
import Button from './Button';
import styles from './AccessNotice.module.css';

/** REQ-205 MSG-086, REQ-206 MSG-087 화면 가운데 안내 */
export default function AccessNotice({ kind }: { kind: AccessNoticeKind }) {
  const navigate = useNavigate();
  const isForbidden = kind === 'forbidden';

  const openTrash = async () => {
    // 삭제 목록은 워크스페이스마다 있다. 설정 화면처럼 첫 워크스페이스로 열고 그 화면에서 바꾼다
    const workspaces = await listMyWorkspaces().catch(() => []);
    navigate(workspaces[0] ? `/workspaces/${workspaces[0].workspaceId}/trash` : '/home');
  };

  return (
    <div className={styles.notice} role="alert">
      <p className={styles.title}>{isForbidden ? '이 폴더를 볼 수 있는 권한이 없어요.' : '삭제된 회의예요.'}</p>
      <p className={styles.description}>
        {isForbidden ? '폴더 소유자에게 초대를 요청해 주세요.' : '삭제 목록에서 3개월 동안 복구할 수 있어요.'}
      </p>
      <div className={styles.actions}>
        {kind === 'deletedRestorable' && (
          <Button type="button" variant="secondary" size="md" onClick={() => void openTrash()}>
            삭제 목록 보기
          </Button>
        )}
        <Button type="button" variant="primary" size="md" onClick={() => navigate('/home')}>
          홈으로
        </Button>
      </div>
    </div>
  );
}
