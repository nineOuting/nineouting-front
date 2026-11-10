import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import styles from './InvitationPage.module.css';

interface JoinConfirmDialogProps {
  workspaceName: string;
  inviterName: string | null;
  error?: string;
  isBusy: boolean;
  onReject: () => void;
  onJoin: () => void;
}

/** REQ-015 초대 참여 확인 창 (MSG-059): [거절하기]는 아무것도 남기지 않고 홈으로 간다 */
export default function JoinConfirmDialog({ workspaceName, inviterName, error, isBusy, onReject, onJoin }: JoinConfirmDialogProps) {
  return (
    <Dialog
      title={`${workspaceName}에 참여할까요?`}
      description={inviterName ? `${inviterName} 님이 초대했어요.` : '워크스페이스에 초대받았어요.'}
      hideClose
      closeOnDimClick={false}
      onClose={onReject}
      footer={
        <>
          <Button variant="secondary" size="md" disabled={isBusy} onClick={onReject}>
            거절하기
          </Button>
          <Button variant="primary" size="md" disabled={isBusy} onClick={onJoin}>
            {isBusy ? '참여하는 중' : '참여하기'}
          </Button>
        </>
      }
    >
      {error && <p className={styles.error}>{error}</p>}
    </Dialog>
  );
}
