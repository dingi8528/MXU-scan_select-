interface FileDialogPathDependencies {
  join: (...paths: string[]) => Promise<string>;
  isDirectory: (path: string) => Promise<boolean>;
}

/** Resolve an opt-in file picker directory without changing its input value. */
export async function resolveFileDialogDefaultPath(
  basePath: string | undefined,
  directory: string | undefined,
  deps: FileDialogPathDependencies,
): Promise<string | undefined> {
  // Existing generic file inputs retain the system dialog's default location.
  if (!directory || !basePath) return undefined;

  try {
    if (!(await deps.isDirectory(basePath))) return undefined;
  } catch {
    return undefined;
  }

  // Configuration paths are literal filesystem paths, not URI-encoded URLs.
  // Inspect both separator styles consistently, regardless of the host OS.
  if (/^[\\/]|[:\u0000-\u001f\u007f]/.test(directory)) return basePath;
  const normalized = directory.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  if (!normalized || normalized === '.') return basePath;
  if (normalized.split('/').some((part) => !part || part === '.' || part === '..')) {
    return basePath;
  }

  try {
    const target = await deps.join(basePath, normalized);
    return (await deps.isDirectory(target)) ? target : basePath;
  } catch {
    // Missing/unreadable folders must not become a filename in the native dialog.
    return basePath;
  }
}
