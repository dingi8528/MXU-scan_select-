import { getDebugDir, isTauri } from './paths';
import { formatRuntimeLogLine } from './runtimeLogText';
import { createRuntimeLogWriter } from './runtimeLogWriter';

const started = new Date();
const session = `${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, '0')}-${String(started.getDate()).padStart(2, '0')}-${started.getTime()}-${Math.random().toString(36).slice(2, 8)}`;
let directory: Promise<string> | undefined;

const writer = createRuntimeLogWriter(
  async (fileName, text) => {
    const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs');
    directory ??= getDebugDir()
      .then(async (dir) => {
        await mkdir(dir, { recursive: true });
        return dir;
      })
      .catch((error) => {
        directory = undefined;
        throw error;
      });
    await writeTextFile(`${await directory}/${fileName}`, text, { append: true });
  },
  session,
  (error) => console.warn('[RuntimeLog] Failed to save UI log:', error),
);

/** 桌面端新增日志自动落盘，恢复缓存时不重复写入。 */
export function saveRuntimeLog(
  instanceId: string,
  log: { timestamp: Date; message: string; html?: string },
  locale?: string,
) {
  if (!isTauri()) return;
  writer.write(instanceId, formatRuntimeLogLine(log, locale));
}

/** 导出日志包前等待已有写入完成。 */
export const flushRuntimeLogFile = writer.flush;
