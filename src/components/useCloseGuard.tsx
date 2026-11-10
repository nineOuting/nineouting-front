import { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

/**
 * REQ-179 입력한 내용이 있는 창을 닫으려 하면 한 번 더 묻는다.
 * 창의 닫기(X), Esc, [취소]가 모두 requestClose를 부르고, confirmElement를 창 옆에 그린다
 */
export default function useCloseGuard(isDirty: boolean, onClose: () => void) {
  const [isAsking, setIsAsking] = useState(false);

  const requestClose = () => {
    if (isDirty) {
      setIsAsking(true);
    } else {
      onClose();
    }
  };

  const confirmElement = isAsking ? (
    <ConfirmDialog
      title="입력한 내용이 사라져요"
      message="창을 닫으면 지금까지 입력한 내용은 저장되지 않아요."
      cancelLabel="계속 입력하기"
      confirmLabel="닫기"
      isDanger
      onCancel={() => setIsAsking(false)}
      onConfirm={() => {
        setIsAsking(false);
        onClose();
      }}
    />
  ) : null;

  return { requestClose, confirmElement };
}
