import {
  ARABIC_FONT_SCALES,
  DEFAULT_READING_SETTINGS,
  parseSettings,
  resolveColorScheme,
  serializeSettings,
  stepFontScale,
} from './settings';

describe('reading settings', () => {
  it('defaults to the system theme, normal size, translation shown, tafsir hidden, normal pace', () => {
    expect(parseSettings([])).toEqual({
      theme: 'system',
      arabicFontScale: 1,
      showTranslation: true,
      showTafsir: false,
      pace: 'normal',
      onboarded: false,
    });
  });

  it('reads back what was stored', () => {
    const stored = {
      theme: 'dark',
      arabicFontScale: 1.3,
      showTranslation: false,
      showTafsir: true,
      pace: 'intense',
      onboarded: true,
    };

    expect(parseSettings(serializeSettings(stored as typeof DEFAULT_READING_SETTINGS))).toEqual(
      stored,
    );
  });

  it('falls back to the default for each value it cannot use, keeping the others', () => {
    const settings = parseSettings([
      { key: 'theme', value: '"sepia"' },
      { key: 'showTafsir', value: 'not json' },
      { key: 'showTranslation', value: '"yes"' },
      { key: 'arabicFontScale', value: '1.15' },
      { key: 'pace', value: '"frantic"' },
      { key: 'onboarded', value: '1' },
    ]);

    expect(settings).toEqual({ ...DEFAULT_READING_SETTINGS, arabicFontScale: 1.15 });
  });

  it('ignores keys it does not know, such as ones from a newer app version', () => {
    expect(parseSettings([{ key: 'hideTashkeel', value: 'true' }])).toEqual(
      DEFAULT_READING_SETTINGS,
    );
  });

  it('keeps a stored font size within the smallest and largest sizes', () => {
    const min = ARABIC_FONT_SCALES[0];
    const max = ARABIC_FONT_SCALES[ARABIC_FONT_SCALES.length - 1];

    expect(parseSettings([{ key: 'arabicFontScale', value: '9' }]).arabicFontScale).toBe(max);
    expect(parseSettings([{ key: 'arabicFontScale', value: '0' }]).arabicFontScale).toBe(min);
  });

  it('stores only the settings that changed', () => {
    expect(serializeSettings({ showTafsir: true })).toEqual([{ key: 'showTafsir', value: 'true' }]);
  });
});

describe('colour scheme', () => {
  it('follows the phone by default, light if the phone does not say', () => {
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
    expect(resolveColorScheme('system', null)).toBe('light');
  });

  it('uses the chosen theme over the phone', () => {
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
  });
});

describe('font size steps', () => {
  it('moves one step up or down', () => {
    expect(stepFontScale(1, 1)).toBe(1.15);
    expect(stepFontScale(1, -1)).toBe(0.85);
  });

  it('stops at the smallest and largest sizes', () => {
    const min = ARABIC_FONT_SCALES[0];
    const max = ARABIC_FONT_SCALES[ARABIC_FONT_SCALES.length - 1];

    expect(stepFontScale(min, -1)).toBe(min);
    expect(stepFontScale(max, 1)).toBe(max);
  });

  it('moves a size between steps to the neighbouring step', () => {
    expect(stepFontScale(1.2, 1)).toBe(1.3);
    expect(stepFontScale(1.2, -1)).toBe(1.15);
  });
});
