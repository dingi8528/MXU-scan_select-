type AppendLog = (fileName: string, text: string) => Promise<void>;

/** 串行追加，初始化期间的日志也排队保存；每个实例单独分卷。 */
export function createRuntimeLogWriter(
  append: AppendLog,
  session: string,
  onError: (error: unknown) => void,
  maxBytes = 5 * 1024 * 1024,
) {
  const files = new Map<string, { number: number; part: number; bytes: number }>();
  const encoder = new TextEncoder();
  let pending = Promise.resolve();

  return {
    write(instanceId: string, text: string) {
      pending = pending
        .then(async () => {
          let file = files.get(instanceId);
          if (!file) {
            file = { number: files.size + 1, part: 1, bytes: 0 };
            files.set(instanceId, file);
          }
          const bytes = encoder.encode(text).byteLength;
          if (file.bytes > 0 && file.bytes + bytes > maxBytes) {
            file.part += 1;
            file.bytes = 0;
          }
          // 文件名只使用内部序号，标签页名称和实例 ID 不参与路径拼接。
          await append(`ui-${session}-tab${file.number}-${file.part}.log`, text);
          file.bytes += bytes;
        })
        .catch(onError);
    },
    flush: () => pending,
  };
}
