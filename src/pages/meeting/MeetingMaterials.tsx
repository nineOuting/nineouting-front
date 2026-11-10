import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { errorMessage } from '../../api/client';
import { deleteMaterial, listMaterials, uploadMaterial, type MeetingMaterial } from '../../api/meeting';
import deleteIcon from '../../assets/icons/delete-sm.svg';
import downloadIcon from '../../assets/icons/download-sm.svg';
import uploadIcon from '../../assets/icons/upload-file.svg';
import Icon from '../../components/Icon';
import Spinner from '../../components/Spinner';
import styles from './MeetingWaitingPage.module.css';

const ICON_SIZE = 16;
const UPLOAD_ICON_SIZE = 24;
// REQ-067 50MB 이하 파일만 (MSG-067). 서버도 다시 확인한다
const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

interface MeetingMaterialsProps {
  meetingId: number;
  /** 참석자만 올린다. 지우기는 서버가 올린 사람, 회의를 만든 사람인지 확인한다 */
  canUpload: boolean;
}

/** REQ-067 회의 사전 자료: 파일은 저장소(S3)에 바로 올리고, 누르면 원래 이름으로 내려받는다 */
export default function MeetingMaterials({ meetingId, canUpload }: MeetingMaterialsProps) {
  const [materials, setMaterials] = useState<MeetingMaterial[] | null>(null);
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let isCurrent = true;
    listMaterials(meetingId)
      .then((items) => isCurrent && setMaterials(items))
      .catch((caught: unknown) => {
        if (isCurrent) {
          setMaterials([]);
          setError(errorMessage(caught));
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [meetingId]);

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setError(undefined);
    for (const file of files) {
      if (file.size > MAX_MATERIAL_BYTES) {
        // MSG-067
        setError(`'${file.name}'을 올리지 못했어요. 50MB 이하 파일만 올릴 수 있어요.`);
        continue;
      }
      setUploading((prev) => [...prev, file.name]);
      try {
        const saved = await uploadMaterial(meetingId, file);
        setMaterials((prev) => [...(prev ?? []), saved]);
      } catch (caught) {
        // MSG-067
        setError(`'${file.name}'을 올리지 못했어요. ${errorMessage(caught)}`);
      } finally {
        setUploading((prev) => prev.filter((name) => name !== file.name));
      }
    }
  };

  const remove = async (material: MeetingMaterial) => {
    try {
      await deleteMaterial(meetingId, material.materialId);
      setMaterials((prev) => prev && prev.filter(({ materialId }) => materialId !== material.materialId));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <>
      {materials && materials.length > 0 && (
        <ul className={styles.materialList}>
          {materials.map((material) => (
            <li key={material.materialId} className={styles.materialItem}>
              <a className={styles.materialLink} href={material.downloadUrl} aria-label={`${material.fileName} 내려받기`}>
                <Icon src={downloadIcon} size={ICON_SIZE} className={styles.mutedIcon} />
                <span className={styles.materialName}>{material.fileName}</span>
              </a>
              <span className={styles.materialMeta}>
                {formatSize(material.size)} · {material.uploadedBy.name ?? '알 수 없음'}
              </span>
              <button
                type="button"
                className={styles.materialDelete}
                aria-label={`${material.fileName} 삭제`}
                onClick={() => void remove(material)}
              >
                <Icon src={deleteIcon} size={ICON_SIZE} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {uploading.map((name) => (
        <p key={name} className={styles.materialUploading}>
          <Spinner size={ICON_SIZE} />
          {name} 올리는 중
        </p>
      ))}
      {canUpload && (
        <>
          <button type="button" className={styles.addMaterial} onClick={() => fileInputRef.current?.click()}>
            <Icon src={uploadIcon} size={UPLOAD_ICON_SIZE} className={styles.mutedIcon} />
            <span className={styles.addMaterialLabel}>자료 추가하기</span>
            <span className={styles.settingCaption}>눌러서 파일을 올려요 (50MB 이하)</span>
          </button>
          <input ref={fileInputRef} type="file" multiple hidden onChange={(event) => void upload(event)} />
        </>
      )}
      {error && (
        <p className={styles.materialError} role="alert">
          {error}
        </p>
      )}
    </>
  );
}
