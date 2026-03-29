export type ReactPageOptions = {
  title: string;
  page: string;
  data: Record<string, unknown>;
  description?: string;
  canonicalUrl?: string;
  robots?: string;
};

export type ManifestEntry = {
  file: string;
  css?: string[];
};

export type ViteManifest = Record<string, ManifestEntry>;

export type ClientAssets = {
  scripts: string[];
  styles: string[];
  isModule: boolean;
};
