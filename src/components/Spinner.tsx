import loadingIcon from '../assets/icons/loading.svg';
import Icon from './Icon';
import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: number;
  className?: string;
}

/** 디자인 LoadingIcon을 돌린다 */
export default function Spinner({ size = 40, className }: SpinnerProps) {
  return <Icon src={loadingIcon} size={size} className={[styles.spinner, className].filter(Boolean).join(' ')} />;
}
