import { useNavigate } from 'react-router-dom';
import waveCharacter from '../assets/characters/wave.svg';
import Icon from './Icon';
import { useSettingsModal } from '../pages/settings/useSettingsModal';
import type { AccessNoticeKind } from '../utils/accessNotice';
import Button from './Button';
import styles from './AccessNotice.module.css';

const CHARACTER_SIZE = 160;

/**
 * REQ-205 MSG-086, REQ-206 MSG-087 화면 가운데 안내.
 * 들어갈 수 없는 폴더는 피그마 2317:46599처럼 넵넵 캐릭터와 [뒤로가기] (2026-11-24 QA)
 */
export default function AccessNotice({ kind }: { kind: AccessNoticeKind }) {
  const navigate = useNavigate();
  const settings = useSettingsModal();
  const isForbidden = kind === 'forbidden';

  return (
    <div className={styles.notice} role="alert">
      {/* 캐릭터는 모양만 쓰고 테마의 보라로 칠한다 (SCRUM-365) */}
      {isForbidden && <Icon src={waveCharacter} size={CHARACTER_SIZE} className={styles.character} />}
      <div className={styles.texts}>
      <p className={styles.title}>{isForbidden ? '이 폴더는 볼 수 없어요' : '삭제된 회의예요.'}</p>
      <p className={styles.description}>
        {isForbidden ? '폴더 소유자에게 초대를 요청해 주세요.' : '삭제 목록에서 3개월 동안 복구할 수 있어요.'}
      </p>
      </div>
      <div className={styles.actions}>
        {kind === 'deletedRestorable' && (
          <Button type="button" variant="secondary" size="md" onClick={() => settings.open('trash')}>
            삭제 목록 보기
          </Button>
        )}
        {isForbidden ? (
          // 앱 안에서 눌러 왔으면 그 화면으로, 주소로 바로 왔으면 홈으로
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/home'))}
          >
            뒤로가기
          </Button>
        ) : (
          <Button type="button" variant="primary" size="md" onClick={() => navigate('/home')}>
            홈으로
          </Button>
        )}
      </div>
    </div>
  );
}
