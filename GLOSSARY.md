# Glossary

The words Lisan's code, issues and docs use for its domain, in plain terms.

**Ayah** — one verse of the Quran, named by its surah and number ("2:255"). Each ayah's words are numbered from 1 by position.

**Part** — a slice of a long ayah, split at its pause marks by the content build (about 8–15 words, never more than 18). A part is one screen in Browse and the session, and a session only ever splits an ayah between its parts. Ayahs short enough to study whole have no parts. In code a part's words are a `WordRange` (`fromWord`–`toWord`).

**Study view** — the one screen that shows an ayah, or one part of a long ayah, fully: the ayah in large script, play/pause, the translation, a card for every word, the linguistic notes and the folded tafsir. Browse, the session and the recap all use it.

**Path** — the curated order in which the app teaches the Quran's ayahs, one daily session at a time. The learner may choose to start later on it ("start at this surah").

**Lemma** — the dictionary form a word comes from (e.g. حَمْد for ٱلۡحَمۡدُ). The learner learns lemmas; a lemma met once counts as learned wherever it appears again.

**Root** — the letters (usually three) a family of lemmas is built from, e.g. ح م د.

**Segment** — one meaningful piece of a word as the morphology splits it: a prefix such as ٱلۡ or لِ, a stem, a suffix. Each segment may have its own lemma, root and grammar.

**Card** — what the learner sees about one word: its meaning and its segments' breakdown (in the study view), and, for review, the lemma the learner is scheduled to recall.

**Review event** — one entry in the learner's append-only log (`LogEvent` in code): a lemma learned, marked known (or undone), added to review from Browse, reviewed with a rating, a session completed at a word, or a start point chosen. Progress, the plan and the review schedule are all worked out by replaying the log; nothing else is stored about learning.

**Browse position** — the place the learner last viewed in a surah in Browse (an ayah, and the part for a long ayah), so the surah reopens there. It is kept on the device and is not a review event.

**Recap** — after a gap of a week or more, the session opens by showing the last few ayahs studied (ayah, audio and translation, with the breakdown on request) before the new material. It records nothing.

**Pace** — how much new material a daily session takes: light, normal or intense, each with its budget of new lemmas and its limit on words.
