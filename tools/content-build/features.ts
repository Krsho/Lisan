import type { Segment } from './morphology.ts';

/** A segment's morphology, described with glossary term keys (see content/glossary.json). */
export type SegmentDescription = {
  lemma: string | null;
  root: string | null;
  /** Ordered: affix role, part of speech, then features in corpus order. */
  terms: string[];
};

/** Tags that make a noun segment a particular kind of noun. */
const NOUN_KINDS: Record<string, string> = {
  PN: 'pos.proper-noun',
  PRON: 'pos.pronoun',
  DEM: 'pos.demonstrative',
  REL: 'pos.relative',
  T: 'pos.time-adverb',
  LOC: 'pos.location-adverb',
  NV: 'pos.verb-like-noun',
  COND: 'pos.conditional-noun',
  INTG: 'pos.interrogative-noun',
};

/** Particle tags, valid on particle segments (coarse part of speech P). */
const PARTICLES: Record<string, string> = {
  P: 'particle.preposition',
  DET: 'particle.definite-article',
  CONJ: 'particle.conjunction',
  REM: 'particle.resumption',
  SUB: 'particle.subordinating',
  ACC: 'particle.accusative',
  NEG: 'particle.negative',
  EMPH: 'particle.emphatic',
  IMPV: 'particle.imperative-lam',
  PRP: 'particle.purpose',
  COND: 'particle.conditional',
  INTG: 'particle.interrogative',
  VOC: 'particle.vocative',
  CERT: 'particle.certainty',
  RES: 'particle.restriction',
  RET: 'particle.retraction',
  PREV: 'particle.preventive',
  FUT: 'particle.future',
  EXP: 'particle.exceptive',
  CAUS: 'particle.cause',
  EXL: 'particle.explanation',
  AMD: 'particle.amendment',
  ANS: 'particle.answer',
  INC: 'particle.inceptive',
  INT: 'particle.interpretation',
  EXH: 'particle.exhortation',
  SUR: 'particle.surprise',
  AVR: 'particle.aversion',
  RSLT: 'particle.result',
  SUP: 'particle.supplemental',
  CIRC: 'particle.circumstantial',
  PRO: 'particle.prohibition',
  EQ: 'particle.equalization',
  COM: 'particle.comitative',
  ATT: 'particle.attention',
  DIST: 'particle.distance',
  ADDR: 'particle.addressee',
  INL: 'particle.quranic-initials',
};

/** Feature tags whose meaning does not depend on the part of speech. */
const FEATURES: Record<string, string> = {
  ACT_PCPL: 'derivation.active-participle',
  PASS_PCPL: 'derivation.passive-participle',
  VN: 'derivation.verbal-noun',
  ADJ: 'attribute.adjective',
  INDEF: 'state.indefinite',
  NOM: 'case.nominative',
  ACC: 'case.accusative',
  GEN: 'case.genitive',
  PERF: 'aspect.perfect',
  IMPF: 'aspect.imperfect',
  IMPV: 'aspect.imperative',
  PASS: 'voice.passive',
  'MOOD:IND': 'mood.indicative',
  'MOOD:SUBJ': 'mood.subjunctive',
  'MOOD:JUS': 'mood.jussive',
  'FAM:إِنّ': 'family.inna',
  'FAM:كَان': 'family.kana',
  'FAM:كَاد': 'family.kada',
  // The addressee كَ is tagged on a few noun segments too.
  ADDR: 'particle.addressee',
};

const PERSON: Record<string, string> = {
  '1': 'person.first',
  '2': 'person.second',
  '3': 'person.third',
};
const GENDER: Record<string, string> = { M: 'gender.masculine', F: 'gender.feminine' };
const NUMBER: Record<string, string> = {
  S: 'number.singular',
  D: 'number.dual',
  P: 'number.plural',
};
const PERSON_GENDER_NUMBER = /^([123])?([MF])?([SDP])?$/;

/**
 * Describes one segment. `inMultiSegmentWord` labels the non-affix segment of a word that has
 * prefixes or suffixes as its stem (a word that is only a stem needs no role label).
 */
export function describeSegment(segment: Segment, inMultiSegmentWord: boolean): SegmentDescription {
  const { pos, tags } = segment;
  const location = `${segment.surah}:${segment.ayah}:${segment.word}:${segment.position}`;
  let lemma: string | null = null;
  let root: string | null = null;
  const roleTerms: string[] = [];
  const kindTerms: string[] = [];
  const featureTerms: string[] = [];

  for (const tag of tags) {
    if (!tag) continue;
    if (tag.startsWith('LEM:')) lemma = tag.slice(4);
    else if (tag.startsWith('ROOT:')) root = tag.slice(5);
    else if (tag.startsWith('VF:')) featureTerms.push(`form.${tag.slice(3)}`);
    else if (tag === 'PREF') roleTerms.push('role.prefix');
    else if (tag === 'SUFF') roleTerms.push('role.suffix');
    else if (pos === 'P' && PARTICLES[tag]) kindTerms.push(PARTICLES[tag]);
    else if (pos === 'N' && NOUN_KINDS[tag]) kindTerms.push(NOUN_KINDS[tag]);
    else if (FEATURES[tag]) featureTerms.push(FEATURES[tag]);
    else if (PERSON_GENDER_NUMBER.test(tag)) {
      const [, person, gender, number] = PERSON_GENDER_NUMBER.exec(tag)!;
      if (person) featureTerms.push(PERSON[person]);
      if (gender) featureTerms.push(GENDER[gender]);
      if (number) featureTerms.push(NUMBER[number]);
    } else {
      throw new Error(`Unknown morphology tag ${tag} in ${location}`);
    }
  }

  if (roleTerms.length === 0 && inMultiSegmentWord) roleTerms.push('role.stem');
  if (kindTerms.length === 0) {
    if (pos === 'N') kindTerms.push('pos.noun');
    else if (pos === 'V') kindTerms.push('pos.verb');
  }
  // EMPH marks both the emphatic lām prefix (لَ) and the emphatic nūn suffix (نَّ).
  const kinds = roleTerms.includes('role.suffix')
    ? kindTerms.map((t) => (t === 'particle.emphatic' ? 'particle.emphatic-nun' : t))
    : kindTerms;
  return { lemma, root, terms: [...roleTerms, ...kinds, ...featureTerms] };
}
