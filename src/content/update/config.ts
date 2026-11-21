/** GitHub repository whose releases host the content databases. */
export const CONTENT_RELEASE_REPO = 'Krsho/Lisan';

/**
 * Where the app looks for newer content. The `content-latest` release is a fixed tag whose
 * manifest is replaced in place on each content release (see content/README.md); a fixed tag
 * keeps it apart from app releases, which GitHub's own "latest release" link would follow.
 */
export const CONTENT_MANIFEST_URL = `https://github.com/${CONTENT_RELEASE_REPO}/releases/download/content-latest/content-manifest.json`;
