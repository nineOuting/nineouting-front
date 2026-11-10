import Button from '../../components/Button';
import Dialog from '../../components/Dialog';

interface ShareConfirmModalProps {
  isSharing: boolean;
  onShare: () => void;
  onClose: () => void;
}

/** REQ-136 작성 완료 확인 (디자인 MinutesEditorPage_CompleteConfirm, MSG-036) */
export default function ShareConfirmModal({ isSharing, onShare, onClose }: ShareConfirmModalProps) {
  return (
    <Dialog
      title="회의록을 저장하고 공유할까요?"
      description="저장하면 이번 회의에 참여한 멤버들에게 회의록이 바로 공유돼요. 내용을 확인한 후 진행해 주세요."
      hideClose
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            계속 수정
          </Button>
          <Button size="md" disabled={isSharing} onClick={onShare}>
            저장하고 공유
          </Button>
        </>
      }
    />
  );
}
