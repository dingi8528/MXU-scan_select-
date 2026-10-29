import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/localContentLink.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { isLocalContentLink, localContentLinkPath, nativeLocalLinkErrorKey, openLocalContentLink } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('普通网站和页内链接保留浏览器行为，明确的本地链接才被拦截', () => {
  for (const href of [
    'https://example.com/',
    'http://127.0.0.1:18765/',
    '#help',
    'mailto:a@b.com',
  ]) {
    assert.equal(isLocalContentLink(href), false, href);
  }
  for (const href of [
    './打开编队编辑器.cmd',
    '../outside.cmd',
    'file:///C:/a.cmd',
    'C:\\a.cmd',
    '\\\\host\\a',
  ]) {
    assert.equal(isLocalContentLink(href), true, href);
  }
});

test('中文、空格、嵌套路径传给原生端，percent 只解码一次', async () => {
  const opened = [];
  for (const href of ['./打开编队编辑器.cmd', './tools/中文%20启动.cmd', './docs/a%2520b.txt']) {
    await openLocalContentLink(href, {
      desktop: true,
      trustedSource: true,
      open: async (path) => opened.push(path),
    });
  }
  assert.deepEqual(opened, ['打开编队编辑器.cmd', 'tools/中文 启动.cmd', 'docs/a%20b.txt']);
});

test('拒绝越界、盘符、UNC、ADS、查询参数与编码后越界路径', async () => {
  const invalid = [
    '../outside.cmd',
    'file:///C:/a.cmd',
    'C:/a.cmd',
    '//host/a.cmd',
    './',
    './a/../b.cmd',
    './%2e%2e/out.cmd',
    './%2fout.cmd',
    './%5cout.cmd',
    './C%3a/a.cmd',
    './a.cmd?args=x',
    './a.cmd#fragment',
    './a%3fstream.cmd',
    './a%00.cmd',
    './a%0a.cmd',
    './a%3astream',
    './bad%zz.cmd',
    './a//b.cmd',
    './a/./b.cmd',
  ];
  for (const href of invalid) {
    assert.throws(() => localContentLinkPath(href), { code: 'invalid' }, href);
    await assert.rejects(
      openLocalContentLink(href, { desktop: true, trustedSource: true, open: assert.fail }),
      { code: 'invalid' },
      href,
    );
  }
});

test('WebUI 与在线来源不会调用原生文件打开', async () => {
  await assert.rejects(
    openLocalContentLink('./open.cmd', { desktop: false, trustedSource: true, open: assert.fail }),
    { code: 'desktopOnly' },
  );
  await assert.rejects(
    openLocalContentLink('./open.cmd', { desktop: true, trustedSource: false, open: assert.fail }),
    { code: 'untrustedSource' },
  );
});

test('原生打开失败向上报告，不能伪报启动成功', async () => {
  const failure = new Error('missing file');
  await assert.rejects(
    openLocalContentLink('./missing.cmd', {
      desktop: true,
      trustedSource: true,
      open: async () => {
        throw failure;
      },
    }),
    (error) => error === failure,
  );
});

test('原生错误用可读提示展示，不把内部错误码直接显示给用户', () => {
  assert.equal(nativeLocalLinkErrorKey('LOCAL_LINK_INVALID'), 'invalid');
  assert.equal(nativeLocalLinkErrorKey('LOCAL_LINK_OUTSIDE_ROOT'), 'invalid');
  assert.equal(nativeLocalLinkErrorKey('LOCAL_LINK_NOT_FOUND'), 'notFound');
  assert.equal(nativeLocalLinkErrorKey('LOCAL_LINK_OPEN_FAILED'), 'openFailed');
  assert.equal(nativeLocalLinkErrorKey(new Error('unexpected')), 'openFailed');
});
