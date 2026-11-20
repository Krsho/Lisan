export type Segment = {
  surah: number;
  ayah: number;
  word: number;
  position: number;
  text: string;
  /** Coarse part of speech: N (noun), V (verb) or P (particle). */
  pos: string;
  /** Feature tags, e.g. ["ROOT:رحم", "LEM:رَحِيم", "MS", "GEN", "ADJ"]. */
  tags: string[];
};

/** Parses the tab-separated corpus morphology: `surah:ayah:word:segment<TAB>text<TAB>pos<TAB>tags`. */
export function parseMorphology(text: string): Segment[] {
  const segments: Segment[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [location, segmentText, pos, tags] = line.split('\t');
    const [surah, ayah, word, position] = location.split(':').map(Number);
    segments.push({
      surah,
      ayah,
      word,
      position,
      text: segmentText,
      pos,
      tags: tags ? tags.split('|') : [],
    });
  }
  return segments;
}
