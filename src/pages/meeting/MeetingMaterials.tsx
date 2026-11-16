import { useEffect, useRef, useState, type DragEvent } from 'react';
import { errorMessage } from '../../api/client';
import {
  deleteMaterial,
  listMaterials,
  uploadMaterial,
  type MaterialSearchStatus,
  type MeetingMaterial,
} from '../../api/meeting';
import closeIcon from '../../assets/icons/close-sm.svg';
import fileIcon from '../../assets/icons/minutes-doc.svg';
import tableIcon from '../../assets/icons/rail-table.svg';
import uploadIcon from '../../assets/icons/upload-file.svg';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import Spinner from '../../components/Spinner';
import styles from './MeetingMaterials.module.css';

const ICON_SIZE = 20;
const SMALL_ICON_SIZE = 16;
const UPLOAD_ICON_SIZE = 24;
// REQ-067 50MB 이하 파일만 (MSG-067). 서버도 다시 확인한다
const MAX_MATERIAL_BYTES = 50 * 1024 * 1024;
const SEARCH_STATUS_POLL_MS = 5000;
const SHEET_EXTENSIONS = /\.(xlsx?|csv)$/i;

/** REQ-187 챗봇 검색 상태 (MSG-078~080). 안 되는 것은 이유를 보여 준다 */
const SEARCH_STATUS: Record<MaterialSearchStatus, { label: string; title?: string; tone: 'muted' | 'ok' | 'warning' }> = {
  PREPARING: { label: '검색 준비 중', tone: 'muted' },
  READY: { label: '챗봇 검색 가능', tone: 'ok' },
  UNREADABLE: { label: '챗봇이 읽을 수 없는 파일', title: '챗봇이 읽을 수 없는 파일이에요. 파일은 그대로 볼 수 있어요.', tone: 'warning' },
  TOO_LARGE: { label: '챗봇 검색에서 빠짐', title: '파일이 너무 커서 챗봇 검색에서 빠졌어요.', tone: 'warning' },
  FAILED: { label: '검색 준비 실패', title: '챗봇 검색 준비에 실패했어요. 파일을 지우고 다시 올려 주세요.', tone: 'warning' },
};

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
  /** 디자인 MeetingWaiting_UploadMaterials: 머리말 [올리기]로 여는 창 */
  isUploadOpen: boolean;
  onUploadClose: () => void;
  /** 머리말 "사전 자료 N"에 쓸 개수 */
  onCountChange?: (count: number) => void;
  /** 다 올린 뒤 알림 (되돌리기를 누르면 방금 올린 자료를 지운다) */
  onUploaded?: (count: number, undo: () => void) => void;
}

/** REQ-067 회의 사전 자료: 파일은 저장소(S3)에 바로 올리고, 누르면 원래 이름으로 내려받는다 */
export default function MeetingMaterials({
  meetingId,
  canUpload,
  isUploadOpen,
  onUploadClose,
  onCountChange,
  onUploaded,
}: MeetingMaterialsProps) {
  const [materials, setMaterials] = useState<MeetingMaterial[] | null>(null);
  const [selected, setSelected] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string>();
  const [uploadError, setUploadError] = useState<string>();
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

  useEffect(() => {
    onCountChange?.(materials?.length ?? 0);
  }, [materials, onCountChange]);

  // REQ-187 검색 준비 중인 자료가 있으면 상태가 정해질 때까지 가끔 다시 본다
  const isPreparing = materials?.some(({ searchStatus }) => searchStatus === 'PREPARING') ?? false;
  useEffect(() => {
    if (!isPreparing) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      listMaterials(meetingId)
        .then(setMaterials)
        .catch(() => undefined);
    }, SEARCH_STATUS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [meetingId, isPreparing]);

  const closeUpload = () => {
    setSelected([]);
    setUploadError(undefined);
    onUploadClose();
  };

  const addFiles = (files: File[]) => {
    const tooLarge = files.filter((file) => file.size > MAX_MATERIAL_BYTES);
    // MSG-067
    setUploadError(tooLarge.length > 0 ? `'${tooLarge[0].name}'을 올리지 못했어요. 50MB 이하 파일만 올릴 수 있어요.` : undefined);
    setSelected((prev) => [...prev, ...files.filter((file) => file.size <= MAX_MATERIAL_BYTES)]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const remove = async (material: MeetingMaterial) => {
    try {
      await deleteMaterial(meetingId, material.materialId);
      setMaterials((prev) => prev && prev.filter(({ materialId }) => materialId !== material.materialId));
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const upload = async () => {
    setIsUploading(true);
    setUploadError(undefined);
    const saved: MeetingMaterial[] = [];
    for (const file of selected) {
      try {
        saved.push(await uploadMaterial(meetingId, file));
      } catch (caught) {
        // MSG-067 디자인 MeetingWaiting_UploadFailed: 창은 그대로 두고 아래에 알린다
        setUploadError(`'${file.name}'을 올리지 못했어요. ${errorMessage(caught)}`);
      }
    }
    setIsUploading(false);
    setMaterials((prev) => [...(prev ?? []), ...saved]);
    setSelected((prev) => prev.filter((file) => !saved.some(({ fileName }) => fileName === file.name)));
    if (saved.length === selected.length) {
      closeUpload();
    }
    if (saved.length > 0) {
      onUploaded?.(saved.length, () => saved.forEach((material) => void remove(material)));
    }
  };

  return (
    <>
      {materials && materials.length > 0 ? (
        <ul className={styles.list}>
          {materials.map((material) => (
            <li key={material.materialId} className={styles.item}>
              <Icon
                src={SHEET_EXTENSIONS.test(material.fileName) ? tableIcon : fileIcon}
                size={ICON_SIZE}
                className={styles.fileIcon}
              />
              <a className={styles.texts} href={material.downloadUrl} aria-label={`${material.fileName} 내려받기`}>
                <span className={styles.name}>{material.fileName}</span>
                <span className={styles.meta}>
                  {formatSize(material.size)} · {material.uploadedBy.name ?? '알 수 없음'}
                  {material.searchStatus && (
                    <span
                      className={`${styles.searchStatus} ${styles[`searchStatus_${SEARCH_STATUS[material.searchStatus].tone}`]}`}
                      title={SEARCH_STATUS[material.searchStatus].title}
                    >
                      {SEARCH_STATUS[material.searchStatus].label}
                    </span>
                  )}
                </span>
              </a>
              {canUpload && (
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`${material.fileName} 삭제`}
                  onClick={() => void remove(material)}
                >
                  <Icon src={closeIcon} size={ICON_SIZE} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{materials ? '아직 올린 자료가 없어요' : '자료를 불러오는 중이에요'}</p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {isUploadOpen && (
        <Dialog
          title="사전 자료 올리기"
          description="회의 전에 함께 볼 자료를 올려 주세요. 참여자 모두 볼 수 있어요"
          width="md"
          hideClose={isUploading}
          onClose={isUploading ? () => undefined : closeUpload}
          footer={
            <>
              <Button variant="secondary" size="md" disabled={isUploading} onClick={closeUpload}>
                취소
              </Button>
              <Button size="md" disabled={selected.length === 0} isLoading={isUploading} onClick={() => void upload()}>
                {isUploading ? '올리는 중' : '올리기'}
              </Button>
            </>
          }
        >
          <div
            className={[styles.dropZone, isDragOver ? styles.dropZoneActive : ''].filter(Boolean).join(' ')}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
          >
            {isUploading ? (
              <Spinner size={UPLOAD_ICON_SIZE} />
            ) : (
              <Icon src={uploadIcon} size={UPLOAD_ICON_SIZE} className={styles.dropIcon} />
            )}
            <p className={styles.dropTitle}>{isUploading ? '자료를 올리고 있어요' : '파일을 여기에 끌어다 놓으세요'}</p>
            <p className={styles.dropText}>또는 파일을 직접 선택할 수 있어요.</p>
            <Button
              variant="secondary"
              size="md"
              className={styles.pickButton}
              disabled={isUploading || !canUpload}
              onClick={() => fileInputRef.current?.click()}
            >
              파일 선택
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = '';
              }}
            />
          </div>
          {selected.length > 0 && (
            <ul className={styles.selectedList}>
              {selected.map((file, index) => (
                <li key={`${file.name}-${index}`} className={styles.selectedItem}>
                  <Icon src={fileIcon} size={SMALL_ICON_SIZE} className={styles.fileIcon} />
                  <span className={styles.name}>{file.name}</span>
                  <span className={styles.meta}>{formatSize(file.size)}</span>
                  {!isUploading && (
                    <button
                      type="button"
                      className={styles.remove}
                      aria-label={`${file.name} 빼기`}
                      onClick={() => setSelected((prev) => prev.filter((_, fileIndex) => fileIndex !== index))}
                    >
                      <Icon src={closeIcon} size={SMALL_ICON_SIZE} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className={uploadError ? styles.error : styles.formats} role={uploadError ? 'alert' : undefined}>
            {uploadError ?? 'PDF · Word · Excel · PowerPoint · 이미지 | 파일당 최대 50MB'}
          </p>
        </Dialog>
      )}
    </>
  );
}
