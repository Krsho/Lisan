import { Stack, useRouter } from 'expo-router';

import { SessionScreen } from '../session/SessionScreen';
import { SettingsHeaderButton } from '../settings/SettingsHeaderButton';

export default function SessionRoute() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={{ headerRight: () => <SettingsHeaderButton /> }} />
      <SessionScreen onDone={() => router.dismissTo('/')} />
    </>
  );
}
