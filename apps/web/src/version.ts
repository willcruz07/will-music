/** The app version, read from apps/web/package.json at build time (vite.config.ts `define`). */
declare const __APP_VERSION__: string;

export const APP_VERSION: string = __APP_VERSION__;

/** Short label for the header: "3.0.0" → "v3.0". */
export const versionLabel = (version = APP_VERSION): string => `v${version.split('.').slice(0, 2).join('.')}`;
