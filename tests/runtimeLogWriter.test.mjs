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

test('异步初始化期间的日志按 UI 顺序写入同一个日期文件', async () => {
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
    'ui-2026-09-12.log',
    (error) => errors.push(error),
  );
  try {
    writer.write('[15:21:22] 正在连接设备…\n');
    writer.write('[15:21:23] 另一个标签页\n');
    writer.write('[15:21:24] 设备连接成功 ✅\n');
    let flushed = false;
    const flush = writer.flush().then(() => {
      flushed = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(flushed, false);
    release();
    await flush;
    assert.deepEqual(await readdir(dir), ['ui-2026-09-12.log']);
    assert.equal(
      await readFile(path.join(dir, 'ui-2026-09-12.log'), 'utf8'),
      '[15:21:22] 正在连接设备…\n[15:21:23] 另一个标签页\n[15:21:24] 设备连接成功 ✅\n',
    );
    assert.deepEqual(errors, []);
  } finally {
    release();
    await writer.flush();
    await rm(dir, { recursive: true, force: true });
  }
});

test('文件名在 writer 创建时固定，持续写入时不会因跨天或体积切换文件', async () => {
  const files = new Map();
  const writer = createRuntimeLogWriter(
    async (file, text) => {
      files.set(file, (files.get(file) || '') + text);
    },
    'ui-2026-09-12.log',
    assert.fail,
  );
  writer.write('中文\n');
  writer.write('后续\n');
  writer.write('完整保留很长的一条日志\n');
  writer.write('末尾\n');
  await writer.flush();
  assert.deepEqual([...files.keys()], ['ui-2026-09-12.log']);
  assert.equal([...files.values()].join(''), '中文\n后续\n完整保留很长的一条日志\n末尾\n');
});

test('同一天多次启动会追加到同一个日期文件', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'mxu-runtime-log-restart-'));
  const append = (file, text) => appendFile(path.join(dir, file), text, 'utf8');
  try {
    const firstRun = createRuntimeLogWriter(append, 'ui-2026-09-12.log', assert.fail);
    firstRun.write('[09:00:00] 第一次运行\n');
    await firstRun.flush();

    const secondRun = createRuntimeLogWriter(append, 'ui-2026-09-12.log', assert.fail);
    secondRun.write('[18:00:00] 第二次运行\n');
    await secondRun.flush();

    assert.deepEqual(await readdir(dir), ['ui-2026-09-12.log']);
    assert.equal(
      await readFile(path.join(dir, 'ui-2026-09-12.log'), 'utf8'),
      '[09:00:00] 第一次运行\n[18:00:00] 第二次运行\n',
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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
  writer.write('first');
  writer.write('second');
  await writer.flush();
  assert.equal(errors.length, 1);
  assert.deepEqual(saved, ['second']);
});

test('文本格式为每个实际行添加同一个 UI 时间', () => {
  assert.equal(
    formatRuntimeLogLine(
      {
        timestamp: new Date(2026, 8, 12, 15, 21, 22),
        message: '连接失败，第 1 次重试…\n1 < 2 & 中文',
      },
      'zh-CN',
    ),
    '[15:21:22] 连接失败，第 1 次重试…\n[15:21:22] 1 < 2 & 中文\n',
  );
});
