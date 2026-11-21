import { useAsync, type AsyncState } from '../async/useAsync';
import { useContent } from '../content/ContentProvider';
import type { Term } from '../content/repository';
import { wordRefKey, type NewLemma, type QuizContent, type QuizWord } from '../engine';

export type QuizData = QuizContent & {
  /** Glossary terms by key, to name the options of grammar questions. */
  terms: Map<string, Term>;
};

/**
 * What the quiz on these new lemmas is built from: their words with segments, every lemma to draw
 * wrong options from, and the glossary. Loaded while the learner studies the new ayah(s).
 */
export function useQuizContent(newLemmas: NewLemma[]): AsyncState<QuizData> {
  const repository = useContent();
  return useAsync(
    async () => {
      const refs = [...new Map(newLemmas.map((l) => [wordRefKey(l.wordRef), l.wordRef])).values()];
      const [details, lemmas, terms] = await Promise.all([
        Promise.all(refs.map((ref) => repository.getWordDetails(ref, 'en'))),
        repository.getLemmaSamples('en'),
        repository.listTerms('en'),
      ]);
      const words: QuizWord[] = details.map((d) => ({
        ref: d.ref,
        bare: d.bare,
        gloss: d.gloss,
        segments: d.segments.map((s) => ({
          text: s.text,
          lemma: s.lemma,
          terms: s.terms.map((t) => t.key),
        })),
      }));
      return { words, lemmas, terms: new Map(terms.map((t) => [t.key, t])) };
    },
    [repository, newLemmas],
    'the quiz',
  );
}
