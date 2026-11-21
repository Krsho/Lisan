/** Version of the bundled content database. Bump whenever the content build output changes. */
export const CONTENT_VERSION = 5;

/**
 * Table layout of the content database that this app build reads. Bump it when tables or
 * columns change in a way older app builds cannot read: they then ignore downloads of the new
 * layout until the app itself is updated (see content/README.md, "Content updates").
 */
export const CONTENT_SCHEMA = 1;
