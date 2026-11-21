import { fireEvent, render, screen } from '@testing-library/react-native';

import type { EventDraft, LogEvent } from '../engine';
import { AddToReview } from './AddToReview';

const kursi = {
  surah: 2,
  ayah: 255,
  words: [
    { position: 1, lemmas: ['allah'] },
    { position: 2, lemmas: ['la'] },
    { position: 3, lemmas: ['ilah'] },
  ],
};

const asLogged = (drafts: EventDraft[]) =>
  drafts.map((d, i) => ({ ...d, id: `e${i}`, deviceId: 'device-a' }) as LogEvent);

it('changes nothing until the learner asks to add the ayah', async () => {
  const record = jest.fn(async () => {});

  await render(<AddToReview ayah={kursi} events={[]} record={record} />);

  expect(screen.getByRole('button', { name: 'Add this ayah to my review' })).toBeTruthy();
  expect(record).not.toHaveBeenCalled();
});

it("adds the ayah's words to review and confirms it", async () => {
  const record = jest.fn(async (_: EventDraft[]) => {});
  const view = await render(<AddToReview ayah={kursi} events={[]} record={record} />);

  await fireEvent.press(screen.getByRole('button', { name: 'Add this ayah to my review' }));

  expect(record).toHaveBeenCalledTimes(1);
  const drafts = record.mock.calls[0][0];
  expect(drafts.map((d) => [d.kind, d.lemmaId])).toEqual([
    ['added', 'allah'],
    ['added', 'la'],
    ['added', 'ilah'],
  ]);

  await view.rerender(<AddToReview ayah={kursi} events={asLogged(drafts)} record={record} />);

  expect(screen.getByText('Added 3 words to your review')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add this ayah to my review' })).toBeNull();
});

it('shows when the ayah is already in review', async () => {
  const added: EventDraft[] = kursi.words.map((w) => ({
    kind: 'added',
    lemmaId: w.lemmas[0],
    wordRef: { surah: 2, ayah: 255, word: w.position },
    timestamp: 1,
  }));

  await render(<AddToReview ayah={kursi} events={asLogged(added)} record={jest.fn()} />);

  expect(screen.getByText('Already in your review')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Add this ayah to my review' })).toBeNull();
});
