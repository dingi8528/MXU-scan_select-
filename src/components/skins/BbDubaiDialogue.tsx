import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '@/stores/appStore';

const IDLE_MIN_MS = 2 * 60_000;
const IDLE_MAX_MS = 4 * 60_000;
const LINE_DURATION_MS = 5_000;
const CLICK_COOLDOWN_MS = 1_000;
const LINE_COUNTS = { idle: 6, click: 8 } as const;

type LineKind = keyof typeof LINE_COUNTS;
type Line = { kind: LineKind; index: number };

export function BbDubaiDialogue({ pageVisible }: { pageVisible: boolean }) {
  const { t } = useTranslation();
  const taskRunning = useAppStore((state) =>
    state.instances.some((instance) => instance.isRunning),
  );
  const [focused, setFocused] = useState(() => document.hasFocus());
  const [line, setLine] = useState<Line | null>(null);
  const lastLines = useRef<Partial<Record<LineKind, number>>>({});
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

  const showLine = useCallback((kind: LineKind) => {
    const previous = lastLines.current[kind];
    const choices = LINE_COUNTS[kind] - (previous === undefined ? 0 : 1);
    const choice = Math.floor(Math.random() * choices);
    const index = previous !== undefined && choice >= previous ? choice + 1 : choice;
    lastLines.current[kind] = index;
    setLine({ kind, index });
  }, []);

  useEffect(() => {
    if (!inForeground) setLine(null);
    else if (taskRunning) setLine((current) => (current?.kind === 'idle' ? null : current));
  }, [inForeground, taskRunning]);

  useEffect(() => {
    if (!inForeground || taskRunning || line) return;
    const delay = IDLE_MIN_MS + Math.random() * (IDLE_MAX_MS - IDLE_MIN_MS);
    const timer = window.setTimeout(() => showLine('idle'), delay);
    return () => window.clearTimeout(timer);
  }, [inForeground, taskRunning, line, showLine]);

  useEffect(() => {
    if (!line) return;
    const timer = window.setTimeout(() => setLine(null), LINE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [line]);

  function talk() {
    const now = performance.now();
    if (now < nextClickAt.current) return;
    nextClickAt.current = now + CLICK_COOLDOWN_MS;
    showLine('click');
  }

  const visibleLine = inForeground && (line?.kind === 'click' || !taskRunning) ? line : null;

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
        {visibleLine && t(`skin.bbDubaiDialogue.${visibleLine.kind}.${visibleLine.index}`)}
      </div>
    </>
  );
}
