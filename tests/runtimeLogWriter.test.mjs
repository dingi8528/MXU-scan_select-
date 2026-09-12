import assert from 'node:assert/strict';
import { mkdtemp, readFile, appendFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

// 使用项目已有的 TypeScript 编译器，不为日志测试增加运行时依赖。
async function loadModule(file) {
  const source = await readFile(new URL(`../src/utils/${file}.ts`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { createRuntimeLogWriter } = await loadModule('runtimeLogWriter');
const { formatRuntimeLogLine } = await loadModule('runtimeLogText');

test('异步初始化期间的日志按 UI 顺序写入，各实例独立保存 UTF-8 文件', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mxu-runtime-log-'));
  const errors = [];
  let release;
  const ready = new Promise((resolve) => {
    release = resolve;
  });
  const writer = createRuntimeLogWriter(
    async (file, text) => {
      await ready;
      await appendFile(path.join(dir, file), text, 'utf8');
    },
    'test',
    (error) => errors.push(error),
  );
  try {
    writer.write('../不安全的实例名', '[15:21:22] 正在连接设备…\n');
    writer.write('second', '[15:21:23] 另一个标签页\n');
    writer.write('../不安全的实例名', '[15:21:24] 设备连接成功 ✅\n');
    let flushed = false;
    const flush = writer.flush().then(() => {
      flushed = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(flushed, false);
    release();
    await flush;
    assert.deepEqual((await readdir(dir)).sort(), ['ui-test-tab1-1.log', 'ui-test-tab2-1.log']);
    assert.equal(
      await readFile(path.join(dir, 'ui-test-tab1-1.log'), 'utf8'),
      '[15:21:22] 正在连接设备…\n[15:21:24] 设备连接成功 ✅\n',
    );
    assert.equal(
      await readFile(path.join(dir, 'ui-test-tab2-1.log'), 'utf8'),
      '[15:21:23] 另一个标签页\n',
    );
    assert.deepEqual(errors, []);
  } finally {
    release();
    await writer.flush();
    await rm(dir, { recursive: true, force: true });
  }
});

test('按 UTF-8 字节分卷，超长单条日志不会被截断', async () => {
  const files = new Map();
  const writer = createRuntimeLogWriter(
    async (file, text) => {
      files.set(file, (files.get(file) || '') + text);
    },
    'rotation',
    assert.fail,
    10,
  );
  writer.write('a', '中文\n'); // 7 bytes
  writer.write('a', '后续\n');
  writer.write('a', '完整保留很长的一条日志\n');
  writer.write('a', '末尾\n');
  await writer.flush();
  assert.equal(files.size, 4);
  assert.equal([...files.values()].join(''), '中文\n后续\n完整保留很长的一条日志\n末尾\n');
});

test('写入失败会报告错误，后续日志仍可继续写入', async () => {
  const errors = [];
  const saved = [];
  let fail = true;
  const writer = createRuntimeLogWriter(
    async (_file, text) => {
      if (fail) {
        fail = false;
        throw new Error('disk unavailable');
      }
      saved.push(text);
    },
    'retry',
    (error) => errors.push(error),
  );
  writer.write('a', 'first');
  writer.write('a', 'second');
  await writer.flush();
  assert.equal(errors.length, 1);
  assert.deepEqual(saved, ['second']);
});

test('文本格式使用原始 UI 时间，保留中文、换行和字面量尖括号', () => {
  assert.equal(
    formatRuntimeLogLine(
      {
        timestamp: new Date(2026, 8, 12, 15, 21, 22),
        message: '连接失败，第 1 次重试…\n1 < 2 & 中文',
      },
      'zh-CN',
    ),
    '[15:21:22] 连接失败，第 1 次重试…\n1 < 2 & 中文\n',
  );
});
