import { useEffect, useState } from 'react';

import { useContent } from '../content/ContentProvider';
import type { Term } from '../content/repository';
import { wordRefKey, type NewLemma, type QuizContent, type QuizWord } from '../engine';

export type QuizData = QuizContent & {
  /** Glossary terms by key, to name the options of grammar questions. */
  terms: Map<string, Term>;
};

export type QuizDataState =
  { status: 'loading' } | { status: 'failed' } | { status: 'loaded'; data: QuizData };

/**
 * What the quiz on these new lemmas is built from: their words with segments, every lemma to draw
 * wrong options from, and the glossary. Loaded while the learner studies the new ayah(s).
 */
export function useQuizContent(newLemmas: NewLemma[]): QuizDataState {
  const repository = useContent();
  const [state, setState] = useState<QuizDataState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const refs = [...new Map(newLemmas.map((l) => [wordRefKey(l.wordRef), l.wordRef])).values()];
    Promise.all([
      Promise.all(refs.map((ref) => repository.getWordDetails(ref, 'en'))),
      repository.getLemmaSamples('en'),
      repository.listTerms('en'),
    ]).then(
      ([details, lemmas, terms]) => {
        if (cancelled) return;
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
        setState({
          status: 'loaded',
          data: { words, lemmas, terms: new Map(terms.map((t) => [t.key, t])) },
        });
      },
      (error: unknown) => {
        console.error('Failed to load the quiz', error);
        if (!cancelled) setState({ status: 'failed' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [repository, newLemmas]);

  return state;
}
