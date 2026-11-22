import { useRef, type ChangeEvent, type RefObject } from 'react';
import { DEFAULT_AVATARS, PROFILE_IMAGE_TYPES } from '../../api/user';
import Button from '../../components/Button';
import Popover from '../../components/Popover';
import styles from './ProfilePhotoPicker.module.css';

interface ProfilePhotoPickerProps {
  anchorRef: RefObject<HTMLElement | null>;
  /** 지금 보이는 기본 캐릭터 키 (default/NN). 올린 사진이면 없음 */
  selectedKey?: string;
  /** MSG-126 올리기 실패 안내. 있으면 [내 사진 올리기] 아래 빨간 글씨 */
  error?: string;
  onSelectDefault: (key: string, url: string) => void;
  onSelectFile: (file: File) => void;
  onClose: () => void;
}

/** REQ-115 디자인 11 PhotoPickerPopover: 기본 캐릭터 9개와 [내 사진 올리기] */
export default function ProfilePhotoPicker({
  anchorRef,
  selectedKey,
  error,
  onSelectDefault,
  onSelectFile,
  onClose,
}: ProfilePhotoPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const changeFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) {
      onSelectFile(file);
    }
  };

  return (
    <Popover label="프로필 사진 고르기" anchorRef={anchorRef} onClose={onClose} className={styles.popover}>
      <p className={styles.title}>기본 이미지</p>
      <div className={styles.grid} role="radiogroup" aria-label="기본 이미지">
        {DEFAULT_AVATARS.map(({ key, url }, index) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selectedKey === key}
            aria-label={`기본 이미지 ${index + 1}`}
            className={[styles.option, selectedKey === key ? styles.selected : ''].filter(Boolean).join(' ')}
            onClick={() => onSelectDefault(key, url)}
          >
            <img src={url} alt="" width={64} height={64} className={styles.avatar} />
          </button>
        ))}
      </div>
      <hr className={styles.divider} />
      <input
        ref={fileRef}
        type="file"
        accept={PROFILE_IMAGE_TYPES.join(',')}
        className={styles.fileInput}
        onChange={changeFile}
      />
      <Button variant="secondary" size="md" block onClick={() => fileRef.current?.click()}>
        내 사진 올리기
      </Button>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        <p className={styles.hint}>JPG·PNG, 5MB까지 올릴 수 있어요</p>
      )}
    </Popover>
  );
}
