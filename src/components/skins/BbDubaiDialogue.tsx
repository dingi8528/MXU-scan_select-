import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { maaService } from '@/services/maaService';
import { useAppStore } from '@/stores/appStore';
import type { TaskFailureReason } from '@/types/maa';
import { loggers } from '@/utils/logger';

const IDLE_INTERVAL_MS = 20_000;
const LINE_DURATION_MS = 5_000;
const CLICK_COOLDOWN_MS = 1_000;
const LINE_COUNTS = { idle: 12, click: 12 } as const;
const FAILURE_KEYS: Record<TaskFailureReason, string> = {
  agent: 'failure.agent',
  controller: 'failure.controller',
  resource: 'failure.resource',
  submission: 'failure.submission',
};

type RandomLineKind = keyof typeof LINE_COUNTS;
type LineKind = RandomLineKind | 'start' | 'success' | 'failure';
type Line = { kind: LineKind; key: string; instanceId: string | null };

export function BbDubaiDialogue({ pageVisible }: { pageVisible: boolean }) {
  const { t } = useTranslation();
  const activeInstanceId = useAppStore((state) => state.activeInstanceId);
  const taskRunning = useAppStore((state) =>
    state.instances.some((instance) => instance.isRunning),
  );
  const [focused, setFocused] = useState(() => document.hasFocus());
  const [line, setLine] = useState<Line | null>(null);
  const [idleRevision, setIdleRevision] = useState(0);
  const lastLines = useRef<Partial<Record<RandomLineKind, number>>>({});
  const nextClickAt = useRef(0);
  const inForeground = pageVisible && focused;

  useEffect(() => {
    const updateFocus = () => setFocused(document.hasFocus());
    updateFocus();
    window.addEventListener('focus', updateFocus);
    window.addEventListener('blur', updateFocus);
    return () => {
      window.removeEventListener('focus', updateFocus);
      window.removeEventListener('blur', updateFocus);
    };
  }, []);

  const showLine = useCallback((kind: LineKind, key: string) => {
    setLine({ kind, key, instanceId: useAppStore.getState().activeInstanceId });
  }, []);

  const showRandomLine = useCallback(
    (kind: RandomLineKind) => {
      const previous = lastLines.current[kind];
      const choices = LINE_COUNTS[kind] - (previous === undefined ? 0 : 1);
      const choice = Math.floor(Math.random() * choices);
      const index = previous !== undefined && choice >= previous ? choice + 1 : choice;
      lastLines.current[kind] = index;
      showLine(kind, `${kind}.${index}`);
    },
    [showLine],
  );

  useEffect(() => {
    if (!inForeground) setLine(null);
    else if (taskRunning) setLine((current) => (current?.kind === 'idle' ? null : current));
  }, [inForeground, taskRunning]);

  useEffect(() => {
    setLine((current) => (current?.instanceId === activeInstanceId ? current : null));
  }, [activeInstanceId]);

  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void maaService
      .onTaskRunEvent((instanceId, event, failureReason) => {
        if (
          disposed ||
          useAppStore.getState().activeInstanceId !== instanceId ||
          document.hidden ||
          !document.hasFocus()
        ) {
          return;
        }
        setIdleRevision((revision) => revision + 1);
        switch (event) {
          case 'stopped':
            setLine((current) => (current?.kind === 'start' ? null : current));
            break;
          case 'started':
            showLine('start', 'start');
            break;
          case 'succeeded':
            showLine('success', 'success');
            break;
          case 'failed':
            showLine(
              'failure',
              failureReason && Object.prototype.hasOwnProperty.call(FAILURE_KEYS, failureReason)
                ? FAILURE_KEYS[failureReason]
                : 'failure.unknown',
            );
            break;
        }
      })
      .then(
        (unlisten) => {
          if (disposed) unlisten();
          else unsubscribe = unlisten;
        },
        (error) => loggers.maa.warn('Failed to subscribe to task run events', error),
      );
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [showLine]);

  useEffect(() => {
    if (!inForeground || taskRunning) return;
    const timer = window.setInterval(() => showRandomLine('idle'), IDLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [activeInstanceId, idleRevision, inForeground, taskRunning, showRandomLine]);

  useEffect(() => {
    if (!line) return;
    const timer = window.setTimeout(() => setLine(null), LINE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [line]);

  function talk() {
    const now = performance.now();
    if (now < nextClickAt.current) return;
    nextClickAt.current = now + CLICK_COOLDOWN_MS;
    setIdleRevision((revision) => revision + 1);
    showRandomLine('click');
  }

  const visibleLine =
    inForeground && line?.instanceId === activeInstanceId && (line.kind !== 'idle' || !taskRunning)
      ? line
      : null;

  return (
    <>
      <button
        type="button"
        className="bb-dubai-dialogue-trigger"
        data-bb-dialogue-trigger
        aria-label={t('skin.bbDubaiDialogue.trigger')}
        onClick={talk}
      >
        <span>{t('skin.bbDubaiDialogue.trigger')}</span>
      </button>
      <div className="bb-dubai-dialogue" role="status" data-bb-dialogue={visibleLine?.kind}>
        {visibleLine && t(`skin.bbDubaiDialogue.${visibleLine.key}`)}
      </div>
    </>
  );
}
