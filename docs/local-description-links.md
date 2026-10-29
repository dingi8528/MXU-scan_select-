# 任务与选项说明中的本地文件链接

桌面 MXU 的任务说明、选项说明、添加任务悬浮说明和预设说明支持显式相对链接：

```markdown
[启动编队编辑器](./打开编队编辑器.cmd)
[查看说明](./docs/使用说明.pdf)
[打开配置目录](./config)
```

链接相对 **MXU 可执行文件所在目录** 解析，与当前进程工作目录无关。中文文件名可直接使用，空格可写成 `%20` 或使用 Markdown 尖括号地址，例如 `[启动](<./tools/中文 启动.cmd>)`。移动整个软件目录后无需改写链接。不接受命令行参数。

任务与选项说明通过 `DescriptionHtml` 统一拦截本地链接，阻止默认网页导航及父级任务/预设按钮的点击。原有 HTTP(S) 与页内链接继续使用原有行为。欢迎公告、日志、更新说明未接入本地启动；通过 URL 加载的任务说明也不允许启动本地文件。

`open_local_link` 只在桌面 Tauri invoke 注册，没有 HTTP/WebUI 路由。浏览器版点击时提示使用桌面客户端，不会请求主机执行。原生命令自行获取 EXE 目录，拒绝绝对路径、盘符、UNC、ADS、父目录和控制符，并对真实目标进行 canonicalize，防止符号链接或 junction 越界；目标必须存在。文件或目录通过系统默认程序打开。CMD 沿用软件本身的启动器，不由说明传入 shell 参数。

这个能力需要重新构建 MXU 可执行文件，单独更新项目 `interface.json` 或任务 JSON 不会使旧客户端获得能力。项目可同时提供 HTTP 入口以便旧客户端重开已启动的服务；安卓发行应删除桌面启动链接。

验证命令：

```text
node --test tests/localContentLink.test.mjs
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml local_link
```
