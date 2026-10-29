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

MaaFGO 当前 `.github/workflows/install.yml` 仍从 `xlxyvergil/MXU-scan_select-` 的最新 Release 下载 MXU。修改 `dingi8528/MXU-scan_select-` 的源码后，需要先发布包含这些改动的客户端，并让 MaaFGO 的构建来源指向相应 Release（或把改动合入现有来源），再验证最终发行包，不能只发布资源包。

验证命令：

```text
node --test tests/localContentLink.test.mjs
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml local_link
```

2026-10-29 本地验收：前端构建、6 项 Node 回归、便携 Rust 编译执行的 6 项原生路径测试及新 Rust 文件的 rustfmt 检查通过。通过真实 `DescriptionHtml`、Markdown 清理与官方 `mockIPC` 进行浏览器点击验证，单击仅调用一次原生命令且不触发父级任务/预设；WebUI、在线说明及越界链接均被拒绝。另用 Windows ShellExecuteExW 实际执行中文空格路径的临时 CMD，普通与 canonical 扩展前缀均成功。MaaFGO 的 18 项安卓打包、8 项 MXU 打包、3 项本地入口以及内联 OCR 静态检查通过。整套 Tauri 可执行文件尚未构建，当前已安装客户端未替换，最终桌面实点及发行包验证仍需新版 EXE。

2026-10-30 真实客户端验收：个人 fork 的 Windows x86_64 调试版与发行版均构建成功（提交 `ca255b4`，Actions run `40897947572`）。在独立中文空格安装目录运行调试版，由用户点击本地链接后，确认 CMD 路径标记、实际编辑服务的安装目录身份及完整网页连接均正确；使用专用测试端口，原编辑服务身份保持不变。测试后已停止专用编辑服务。桌面截图与输入接口异常，因此点击由用户协助完成，验收依据为真实原生控件树、后台结果和文件记录；没有把浏览器模拟当作此次原生验收。
