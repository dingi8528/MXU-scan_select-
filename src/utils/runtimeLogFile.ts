import { getDebugDir, isTauri } from './paths';
import { formatRuntimeLogLine } from './runtimeLogText';
import { createRuntimeLogWriter } from './runtimeLogWriter';

const started = new Date();
// 启动时确定文件名；即使程序跨过零点，本次会话也继续写入启动当天的文件。
const fileName = `ui-${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, '0')}-${String(started.getDate()).padStart(2, '0')}.log`;
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
  fileName,
  (error) => console.warn('[RuntimeLog] Failed to save UI log:', error),
);

/** 桌面端新增日志自动落盘，恢复缓存时不重复写入。 */
export function saveRuntimeLog(
  log: { timestamp: Date; message: string; html?: string },
  locale?: string,
) {
  if (!isTauri()) return;
  writer.write(formatRuntimeLogLine(log, locale));
}

/** 导出日志包前等待已有写入完成。 */
export const flushRuntimeLogFile = writer.flush;

/** 启动清理时保留当天正在追加的 UI 日志。 */
export const getRuntimeLogFileName = () => fileName;
