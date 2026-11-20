# Lisan — Understand the Quran's Arabic

A free, open-source mobile app that teaches the Arabic of the Quran through a short daily session: review earlier words, study a new ayah word by word (meaning, root, grammar), read its translation and tafsir, then take a quick quiz.

Lisan is for learners who can already read Arabic script. See the v1 spec in [issue #1](https://github.com/Krsho/Lisan/issues/1).

## Development

Requires Node 24.

```sh
npm install
npm run content:fetch   # downloads the Quran font and content sources (not in git)
npm start          # start the Expo dev server, then open it in Expo Go
npm test           # run tests
npm run check      # everything CI runs
npm run typecheck  # TypeScript
npm run lint       # ESLint
npm run format     # Prettier
```

## License

[GPL-3.0](LICENSE). Quran text, morphology, translation and tafsir data come from third-party sources credited in the app once added.
