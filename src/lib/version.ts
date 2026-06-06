/**
 * Build metadata, inlined via next.config `env` (see next.config.ts). The
 * fallbacks apply in dev/test where the build-time injection hasn't run.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";
export const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA ?? "";
export const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME ?? "";
