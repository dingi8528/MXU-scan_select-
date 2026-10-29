import { useRef, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { isTauri } from '@/utils/paths';
import {
  isLocalContentLink,
  LocalLinkError,
  nativeLocalLinkErrorKey,
  openLocalContentLink,
} from '@/utils/localContentLink';
import { loggers } from '@/utils/logger';

/** Project descriptions only: do not use this component for logs or online announcements. */
export function DescriptionHtml({
  html,
  className,
  allowLocalLinks,
}: {
  html: string;
  className?: string;
  allowLocalLinks: boolean;
}) {
  const { t } = useTranslation();
  const opening = useRef(false);

  const localAnchor = (event: MouseEvent<HTMLDivElement>) => {
    const element = event.target instanceof Element ? event.target : null;
    const anchor = element?.closest('a');
    if (!anchor || !event.currentTarget.contains(anchor)) return null;
    const href = anchor.getAttribute('href');
    return href && isLocalContentLink(href) ? href : null;
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const href = localAnchor(event);
    if (href === null) return;
    event.preventDefault();
    // Descriptions may be inside task/preset buttons; opening a file must not apply them.
    event.stopPropagation();
    if (opening.current) return;
    opening.current = true;
    void openLocalContentLink(href, {
      desktop: isTauri(),
      trustedSource: allowLocalLinks,
      open: (relativePath) => invoke('open_local_link', { relativePath }),
    })
      .catch((error: unknown) => {
        if (error instanceof LocalLinkError) {
          toast.error(t(`localLink.${error.code}`));
        } else {
          loggers.ui.warn('Failed to open project local link:', error);
          toast.error(t(`localLink.${nativeLocalLinkErrorKey(error)}`));
        }
      })
      .finally(() => {
        opening.current = false;
      });
  };

  return (
    <div
      className={className}
      onClick={handleClick}
      onAuxClick={(event) => {
        if (localAnchor(event) !== null) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
