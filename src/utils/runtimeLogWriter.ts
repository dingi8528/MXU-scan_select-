type AppendLog = (fileName: string, text: string) => Promise<void>;

/** 串行追加，确保初始化期间及多个标签页产生的日志按发生顺序写入同一文件。 */
export function createRuntimeLogWriter(
  append: AppendLog,
  fileName: string,
  onError: (error: unknown) => void,
) {
  let pending = Promise.resolve();

  return {
    write(text: string) {
      pending = pending.then(() => append(fileName, text)).catch(onError);
    },
    flush: () => pending,
  };
}
