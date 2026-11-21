import { useRouter } from 'expo-router';

import { SurahList } from '../browse/SurahList';

/** Browse the whole Quran: every surah, outside the curated path. */
export default function BrowseRoute() {
  const router = useRouter();
  return (
    <SurahList
      onOpenSurah={(surah) =>
        router.push({ pathname: '/surah/[surah]', params: { surah: String(surah) } })
      }
    />
  );
}
