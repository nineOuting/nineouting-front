import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../components/AuthLayout';
import Button from '../../components/Button';
import Placeholder from '../../components/Placeholder';
import styles from './CompleteScreen.module.css';

const ILLUSTRATION_SIZE = 360;

interface CompleteScreenProps {
  title: string;
  message: string;
}

/** 회원가입 완료·비밀번호 변경 완료. "로그인하기" 클릭 시 로그인 화면으로 이동 */
export default function CompleteScreen({ title, message }: CompleteScreenProps) {
  const navigate = useNavigate();

  return (
    <AuthLayout className={styles.page}>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.message}>{message}</p>
      <Placeholder size={ILLUSTRATION_SIZE} variant="image" className={styles.illustration} />
      <div className={styles.action}>
        <Button onClick={() => navigate('/login')}>로그인하기</Button>
      </div>
    </AuthLayout>
  );
}
