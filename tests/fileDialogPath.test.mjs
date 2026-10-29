import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../src/utils/fileDialogPath.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { resolveFileDialogDefaultPath } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

const deps = {
  join: async (...parts) => path.join(...parts),
  isDirectory: async (name) => (await stat(name)).isDirectory(),
};

async function fixture(run) {
  const root = await mkdtemp(path.join(tmpdir(), 'MXU 文件选择 中文 空格-'));
  try {
    await run(root);
  } finally {
    // The fixture's freshly allocated directory only; no caller-provided paths.
    await rm(root, { recursive: true, force: true });
  }
}

test('已配置且存在的目录相对本安装目录打开，支持中文与空格', async () => {
  await fixture(async (root) => {
    const target = path.join(root, 'config', 'Battle');
    await mkdir(target, { recursive: true });
    assert.equal(await resolveFileDialogDefaultPath(root, 'config/Battle', deps), target);
    assert.equal(await resolveFileDialogDefaultPath(root, './config/Battle/', deps), target);
    assert.equal(await resolveFileDialogDefaultPath(root, 'config\\Battle', deps), target);
  });
});

test('首次运行没有目标目录时回退软件目录，且不创建目录', async () => {
  await fixture(async (root) => {
    assert.equal(await resolveFileDialogDefaultPath(root, 'config/Battle', deps), root);
    await assert.rejects(stat(path.join(root, 'config')), { code: 'ENOENT' });
  });
});

test('目标为同名文件或不可访问时回退软件目录', async () => {
  await fixture(async (root) => {
    await mkdir(path.join(root, 'config'));
    await writeFile(path.join(root, 'config/Battle'), 'not a directory');
    assert.equal(await resolveFileDialogDefaultPath(root, 'config/Battle', deps), root);
    assert.equal(
      await resolveFileDialogDefaultPath(root, 'config/Private', {
        ...deps,
        isDirectory: async (name) => {
          if (name !== root) throw new Error('EACCES');
          return true;
        },
      }),
      root,
    );
  });
});

test('未配置目录或没有项目根路径时不改变通用文件选择器默认值', async () => {
  const unexpected = { join: assert.fail, isDirectory: assert.fail };
  assert.equal(await resolveFileDialogDefaultPath('/project', undefined, unexpected), undefined);
  assert.equal(await resolveFileDialogDefaultPath('/project', '', unexpected), undefined);
  assert.equal(
    await resolveFileDialogDefaultPath(undefined, 'config/Battle', unexpected),
    undefined,
  );
  assert.equal(await resolveFileDialogDefaultPath('', 'config/Battle', unexpected), undefined);
});

test('无效或不可访问的根目录不作为原生对话框的文件名', async () => {
  await fixture(async (root) => {
    const file = path.join(root, 'file');
    await writeFile(file, 'file');
    assert.equal(await resolveFileDialogDefaultPath(file, 'config/Battle', deps), undefined);
    assert.equal(
      await resolveFileDialogDefaultPath(path.join(root, 'missing'), 'config/Battle', deps),
      undefined,
    );
    assert.equal(
      await resolveFileDialogDefaultPath(root, 'config/Battle', {
        ...deps,
        isDirectory: async () => {
          throw new Error('EACCES');
        },
      }),
      undefined,
    );
  });
});

test('绝对路径、盘符、UNC与父目录配置不会改变本安装目录', async () => {
  await fixture(async (root) => {
    for (const directory of [
      '/outside',
      '\\outside',
      '//server/share',
      '\\\\server\\share',
      'C:\\outside',
      'C:outside',
      '../outside',
      'config/../outside',
      'config\\..\\outside',
      'file:///outside',
      'https://example.com',
      'config\0/Battle',
      'config\n/Battle',
    ]) {
      assert.equal(
        await resolveFileDialogDefaultPath(root, directory, { ...deps, join: assert.fail }),
        root,
        directory,
      );
    }
  });
});

test('路径拼接异常回退软件目录，输入框的 URL 或 ID 不参与目录计算', async () => {
  await fixture(async (root) => {
    assert.equal(
      await resolveFileDialogDefaultPath(root, 'config/Battle', {
        ...deps,
        join: async () => {
          throw new Error('invalid path');
        },
      }),
      root,
    );
    // The helper deliberately has no input value argument; it uses configuration only.
    const second = path.join(root, '第二个安装目录');
    await mkdir(path.join(second, 'config/Battle'), { recursive: true });
    assert.equal(
      await resolveFileDialogDefaultPath(second, 'config/Battle', deps),
      path.join(second, 'config/Battle'),
    );
  });
});
