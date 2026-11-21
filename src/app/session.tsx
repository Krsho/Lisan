import { useRouter } from 'expo-router';

import { SessionScreen } from '../session/SessionScreen';

export default function SessionRoute() {
  const router = useRouter();
  return <SessionScreen onDone={() => router.dismissTo('/')} />;
}
