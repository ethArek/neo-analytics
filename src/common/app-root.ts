import { join } from 'path';

type ResolveAppRootOptions = {
  runtimeDirname: string;
  runtimeCwd: string;
  pathExists: (filePath: string) => boolean;
};

export function resolveAppRoot(options: ResolveAppRootOptions): string {
  const candidates = [
    join(options.runtimeDirname, '..'),
    join(options.runtimeDirname, '..', '..'),
    options.runtimeCwd,
  ];

  for (const candidate of candidates) {
    if (options.pathExists(join(candidate, 'package.json'))) {

      return candidate;
    }
  }

  return options.runtimeCwd;
}

