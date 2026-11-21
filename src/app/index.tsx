import { useRouter } from 'expo-router';

import { SurahList } from '../browse/SurahList';

/** Home: browse the whole Quran (the daily session will take this place later). */
export default function HomeRoute() {
  const router = useRouter();
  return (
    <SurahList
      onOpenSurah={(surah) =>
        router.push({ pathname: '/surah/[surah]', params: { surah: String(surah) } })
      }
    />
  );
}
