import { fireEvent, render, screen } from '@testing-library/react-native';

import { AyahTranslation } from './AyahTranslation';

const ayah = {
  ayah: 4,
  translation: 'Master[5] of the Day of Judgment.',
  footnotes: '[5] Other meanings for "Mālik": Sovereign, Owner, etc.',
  tafsir: '4. He is the Master of the day of Judgement.',
};

it('shows the translation and its footnotes, with the tafsir collapsed until opened', async () => {
  await render(<AyahTranslation data={ayah} />);

  expect(screen.getByText('Master[5] of the Day of Judgment.')).toBeTruthy();
  expect(screen.getByText('[5] Other meanings for "Mālik": Sovereign, Owner, etc.')).toBeTruthy();
  expect(screen.queryByText(ayah.tafsir)).toBeNull();

  await fireEvent.press(screen.getByRole('button', { name: 'Show tafsir' }));

  expect(screen.getByText('4. He is the Master of the day of Judgement.')).toBeTruthy();
});
