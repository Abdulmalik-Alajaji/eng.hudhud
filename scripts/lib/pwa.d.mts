// أنواع scripts/lib/pwa.mjs لاستيرادها من vite.config.ts.
export declare const SERVICE_WORKER: string;
export declare function isPrecached(relativePath: string): boolean;
export declare function precacheUrls(relativePaths: string[], base: string): string[];
export declare function cacheVersion(files: { path: string; content: Uint8Array | string }[]): string;
export declare function renderServiceWorker(
  template: string,
  values: { version: string; base: string; urls: string[] },
): string;
export declare function readPrecache(serviceWorker: string): string[] | null;
export declare function pwaProblems(build: { files: string[]; read: (path: string) => string; base: string }): string[];
