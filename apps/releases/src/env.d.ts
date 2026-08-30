/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Cloudflare Web Analytics site token. Unset locally; the beacon just doesn't render. */
  readonly PUBLIC_CF_BEACON_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
