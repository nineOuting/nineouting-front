import { useEffect, useRef, useState, type DragEvent } from 'react';
import { errorMessage } from '../../api/client';
import {
  getTemplateImport,
  startTemplateImport,
  templateImportType,
  TEMPLATE_IMPORT_MAX_BYTES,
  TEMPLATE_IMPORT_TYPES,
} from '../../api/minutes';
import errorIcon from '../../assets/icons/error.svg';
import fileIcon from '../../assets/icons/minutes-doc.svg';
import uploadIcon from '../../assets/icons/upload-file.svg';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import Spinner from '../../components/Spinner';
import styles from './TemplateImportModal.module.css';

const ICON_SIZE = 20;
const UPLOAD_ICON_SIZE = 24;
// 서버가 뒤에서 분석한다 (보통 4~25초, 최대 약 2분). 이 간격으로 결과를 묻고, 이 시간이 지나면 실패로 본다
const POLL_MS = 2000;
const GIVE_UP_MS = 5 * 60 * 1000;
const ACCEPT = ['.pdf', '.docx', ...Object.values(TEMPLATE_IMPORT_TYPES)].join(',');
// 임시 문구 (2026-11-24): 기획에서 정하는 중
const INVALID_FILE_MESSAGE = 'PDF나 Word 파일만 20MB까지 올릴 수 있어요';
const FAILED_FALLBACK_MESSAGE = '양식을 분석하지 못했어요. 다른 파일로 다시 시도해 주세요';

type Step = 'upload' | 'reading' | 'failed';

interface TemplateImportModalProps {
  onClose: () => void;
  /** 새 양식이 저장됐을 때. 목록은 그대로 두고 새로 고친다 */
  onImported: (templateId: number, name: string) => void;
}

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

/** report.pdf → report */
const nameOf = (file: File) => file.name.replace(/\.[^.]+$/, '').trim() || '가져온 양식';

/**
 * REQ-195 디자인 Version02 TemplateImportModal (Upload → Reading → Failed): 회의록 PDF나 Word 파일을 올리면
 * 서버가 AI로 항목을 읽어 새 개인 양식으로 저장한다. 접수만 바로 되고 분석은 뒤에서 하므로 결과를 다시 묻는다
 */
export default function TemplateImportModal({ onClose, onImported }: TemplateImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [failure, setFailure] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // 창을 닫으면 결과 묻기를 멈춘다
  const isOpenRef = useRef(true);

  useEffect(() => {
    isOpenRef.current = true;
    return () => {
      isOpenRef.current = false;
    };
  }, []);

  const fail = (message: string) => {
    setFailure(message);
    setStep('failed');
  };

  const pick = (picked: File | undefined) => {
    if (!picked) {
      return;
    }
    setFile(picked);
    if (!templateImportType(picked) || picked.size > TEMPLATE_IMPORT_MAX_BYTES) {
      fail(INVALID_FILE_MESSAGE);
      return;
    }
    setStep('upload');
  };

  const runImport = async () => {
    if (!file) {
      return;
    }
    setStep('reading');
    try {
      let job = await startTemplateImport(file, nameOf(file));
      const giveUpAt = Date.now() + GIVE_UP_MS;
      while (job.status === 'PENDING' && Date.now() < giveUpAt) {
        await sleep(POLL_MS);
        if (!isOpenRef.current) {
          return;
        }
        job = await getTemplateImport(job.importId);
      }
      if (!isOpenRef.current) {
        return;
      }
      if (job.status === 'SUCCEEDED' && job.templateId !== null) {
        onImported(job.templateId, nameOf(file));
      } else {
        fail(job.message ?? FAILED_FALLBACK_MESSAGE);
      }
    } catch (error) {
      if (isOpenRef.current) {
        fail(errorMessage(error));
      }
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    pick(event.dataTransfer.files[0]);
  };

  return (
    <Dialog
      title="양식 가져오기"
      description="기존 회의록 PDF나 Word 파일을 올리면 항목을 분석해 편집할 수 있는 양식으로 변환해 드려요."
      width="md"
      hideClose={step === 'reading'}
      onClose={step === 'reading' ? () => undefined : onClose}
      footer={
        <>
          <Button variant="secondary" size="md" disabled={step === 'reading'} onClick={onClose}>
            취소
          </Button>
          {step === 'failed' ? (
            <Button size="md" onClick={() => inputRef.current?.click()}>
              다른 파일 올리기
            </Button>
          ) : (
            <Button size="md" disabled={!file} isLoading={step === 'reading'} onClick={() => void runImport()}>
              {step === 'reading' ? '분석하는 중' : '가져오기'}
            </Button>
          )}
        </>
      }
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(event) => {
          pick(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      {step === 'failed' && (
        <div className={styles.failed} role="alert">
          <Icon src={errorIcon} size={ICON_SIZE} className={styles.failedIcon} />
          <div>
            {/* 임시 문구 (2026-11-24): 실패 이유는 서버가 준 문구를 그대로 보인다 */}
            <p className={styles.failedTitle}>{failure}</p>
            <p className={styles.failedText}>다른 PDF나 Word 파일을 선택해 주세요.</p>
          </div>
        </div>
      )}
      {step === 'reading' && (
        <div className={styles.reading} role="status">
          <Spinner size={UPLOAD_ICON_SIZE} />
          <p className={styles.dropTitle}>파일을 분석하고 있어요</p>
          <p className={styles.dropText}>항목을 찾아 양식으로 바꾸는 중이에요. 길게는 2분쯤 걸려요.</p>
        </div>
      )}
      {step === 'upload' && (
        <div
          className={[styles.dropZone, isDragOver ? styles.dropZoneActive : ''].filter(Boolean).join(' ')}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <Icon src={uploadIcon} size={UPLOAD_ICON_SIZE} />
          <p className={styles.dropTitle}>PDF나 Word 파일을 여기에 끌어다 놓으세요</p>
          <p className={styles.dropText}>또는 파일을 직접 선택할 수 있어요. 20MB까지 올릴 수 있어요.</p>
          <Button variant="secondary" size="md" className={styles.pickButton} onClick={() => inputRef.current?.click()}>
            파일 선택
          </Button>
        </div>
      )}
      {file && step !== 'reading' && (
        <p className={styles.file}>
          <Icon src={fileIcon} size={ICON_SIZE} />
          {file.name}
        </p>
      )}
    </Dialog>
  );
}
