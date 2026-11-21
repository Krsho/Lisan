// Prepares the files of a content release in dist/content-release/ from assets/content/content.db.
// It publishes nothing: see content/README.md, "Content updates", for the release steps.
import { join } from 'node:path';

import { CONTENT_RELEASE_REPO } from '../../src/content/update/config.ts';
import { CONTENT_SCHEMA, CONTENT_VERSION } from '../../src/content/version.ts';
import { prepareContentRelease } from './release.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const outDir = join(ROOT, 'dist', 'content-release');

const { manifest, files } = prepareContentRelease({
  dbFile: join(ROOT, 'assets', 'content', 'content.db'),
  outDir,
  contentVersion: CONTENT_VERSION,
  schema: CONTENT_SCHEMA,
  repo: CONTENT_RELEASE_REPO,
});

const [dbFile, manifestFile] = files;
console.log(`Prepared content release v${manifest.version} (schema ${manifest.schema}):`);
console.log(JSON.stringify(manifest, null, 2));
console.log(`
To publish it (see content/README.md):
  gh release create content-v${manifest.version} "${dbFile}" --repo ${CONTENT_RELEASE_REPO} --title "Content v${manifest.version}" --notes "<what changed>"
  gh release upload content-latest "${manifestFile}" --repo ${CONTENT_RELEASE_REPO} --clobber`);
