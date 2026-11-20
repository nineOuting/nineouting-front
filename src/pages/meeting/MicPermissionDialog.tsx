import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import styles from './MicPermissionDialog.module.css';

interface MicPermissionDialogProps {
  /** request: 처음 한 번 권한을 묻기 전 (MSG-065), denied: 거부했거나 꺼져 있음 (MSG-066) */
  state: 'request' | 'denied';
  isChecking: boolean;
  onAllow: () => void;
  onClose: () => void;
}

/** REQ-078 마이크 권한 요청과 거부 안내 */
export default function MicPermissionDialog({ state, isChecking, onAllow, onClose }: MicPermissionDialogProps) {
  if (state === 'request') {
    return (
      <Dialog
        title="마이크 사용을 허용해 주세요"
        description="회의 내용을 기록하려면 마이크 권한이 필요해요."
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={onClose}>
              나중에 하기
            </Button>
            <Button isLoading={isChecking} variant="primary" size="md" disabled={isChecking} onClick={onAllow}>
              마이크 허용하기
            </Button>
          </>
        }
      >
        {/* MSG-065 디자인 06 상태 모음 "마이크 권한 요청" */}
        <div className={styles.notes}>
          <p>브라우저에 권한 요청 창이 뜨면 [허용]을 눌러 주세요.</p>
          <p>녹음은 회의 중에만 켜지고, 언제든 일시정지할 수 있어요.</p>
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog
      title="마이크 권한이 꺼져 있어요"
      description="마이크를 허용해야 회의를 기록할 수 있어요. 아래 순서대로 바꿔 주세요."
      width="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            닫기
          </Button>
          <Button isLoading={isChecking} variant="primary" size="md" disabled={isChecking} onClick={onAllow}>
            {isChecking ? '확인하는 중' : '다시 확인하기'}
          </Button>
        </>
      }
    >
      <ol className={styles.steps}>
        <li>주소창 왼쪽의 사이트 정보 아이콘을 눌러요</li>
        <li>마이크를 [허용]으로 바꿔요</li>
        <li>[다시 확인하기]를 눌러요</li>
      </ol>
    </Dialog>
  );
}
