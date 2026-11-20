# Lisan — Understand the Quran's Arabic

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues for [Krsho/Lisan](https://github.com/Krsho/Lisan) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five default triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Expo

This is an Expo / React Native app (Expo SDK 58). Expo ships breaking changes every SDK release, so don't trust remembered APIs: check the versioned docs at `https://docs.expo.dev/versions/v58.0.0/` or the index at https://docs.expo.dev/llms.txt before using an Expo, EAS or React Native API.

- Add packages with `npx expo install <package>` so versions match the SDK. If that fails on this npm version (`EALLOWSCRIPTS`), look up the SDK version in `expo/bundledNativeModules.json` and `npm install` it directly.
- `ios/` and `android/` are generated; never edit them by hand. Configure native behaviour in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. Prefer libraries that work in Expo Go; development testing happens on a physical iPhone and Android device through Expo Go.
- App code lives in `src/`.

## Checks

Run before declaring work done: `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`. CI runs the same on every push and pull request.
