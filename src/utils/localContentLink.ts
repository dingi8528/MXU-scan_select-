export type LocalLinkErrorCode = 'invalid' | 'desktopOnly' | 'untrustedSource';

export class LocalLinkError extends Error {
  constructor(public readonly code: LocalLinkErrorCode) {
    super(code);
  }
}

export function nativeLocalLinkErrorKey(error: unknown): 'invalid' | 'notFound' | 'openFailed' {
  const message = String(error);
  if (message === 'LOCAL_LINK_INVALID' || message === 'LOCAL_LINK_OUTSIDE_ROOT') return 'invalid';
  if (message === 'LOCAL_LINK_NOT_FOUND') return 'notFound';
  return 'openFailed';
}

/** Only explicit relative links opt in. Also intercept unsafe local URI forms. */
export function isLocalContentLink(href: string): boolean {
  return /^(?:\.{1,2}[\\/]|file:|[a-z]:[\\/]|\\\\)/i.test(href.trim());
}

/** Decode once; the native command independently validates the canonical target. */
export function localContentLinkPath(href: string): string {
  if (!href.startsWith('./') || /[?#]/.test(href)) throw new LocalLinkError('invalid');
  let path: string;
  try {
    path = decodeURIComponent(href.slice(2));
  } catch {
    throw new LocalLinkError('invalid');
  }
  if (
    !path ||
    /[\\:\u0000-\u001f\u007f?#]/.test(path) ||
    path.split('/').some((part) => !part || part === '.' || part === '..')
  ) {
    throw new LocalLinkError('invalid');
  }
  return path;
}

export async function openLocalContentLink(
  href: string,
  options: {
    desktop: boolean;
    trustedSource: boolean;
    open: (relativePath: string) => Promise<unknown>;
  },
): Promise<void> {
  if (!options.trustedSource) throw new LocalLinkError('untrustedSource');
  if (!options.desktop) throw new LocalLinkError('desktopOnly');
  await options.open(localContentLinkPath(href));
}
