import styles from './Placeholder.module.css';

interface PlaceholderProps {
  size: number;
  variant?: 'icon' | 'toast' | 'image';
  className?: string;
}

// 디자인에서 아이콘·일러스트가 아직 회색 사각형으로만 잡혀 있어 같은 모양으로 자리만 잡아 둔다
export default function Placeholder({ size, variant = 'icon', className }: PlaceholderProps) {
  return (
    <span
      aria-hidden="true"
      className={[styles.placeholder, styles[variant], className].filter(Boolean).join(' ')}
      style={{ width: size, height: size }}
    />
  );
}
