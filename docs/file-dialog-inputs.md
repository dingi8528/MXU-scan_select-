# 文件输入的默认目录与筛选

`InputItem` 的 `input_type: "file"` 可以声明以下 MXU 扩展字段：

```json
{
  "name": "chaldea_import_source",
  "input_type": "file",
  "file_dialog_dir": "config/Battle",
  "file_dialog_filters": [
    { "name": "JSON", "extensions": ["json"] },
    { "name": "All Files", "extensions": ["*"] }
  ]
}
```

`file_dialog_dir` 相对于当前软件／`interface.json` 所在目录解析，使用 Tauri 的路径 API 拼接，支持中文和空格。目标存在且为目录时作为原生文件对话框的 `defaultPath`；不存在、同名文件或无法访问时回退到有效的软件根目录。根目录也不可用时不指定 `defaultPath`。浏览按钮不创建目录。

`file_dialog_filters` 按声明顺序传给原生对话框，第一项为默认文件类型。扩展名不带点，`*` 表示所有文件；名称支持现有项目国际化解析。未配置筛选时保留通用文件输入的可执行文件／所有文件筛选，未配置目录时保留系统默认起始位置。

输入框内容不参与起始目录计算，因此原有分享链接、队伍 ID、文件名和旧安装目录中的路径都可以保留。选择成功后写回对话框返回的完整文件路径；取消不修改原输入。浏览器 WebUI 仍仅支持手动输入，不调用桌面文件对话框。

目录检查使用 `plugin-fs` 的 `stat`，桌面 capability 为其配置了与已有文件读取相同范围的 `fs:allow-stat`；路径拼接沿用 `core:path:default`，文件选择沿用 `dialog:allow-open`。不新增 Rust 命令或 HTTP 路由。

验证命令：

```text
node --test tests/fileDialogPath.test.mjs
pnpm build
```

此能力需要重新构建并更新 MXU 可执行文件。仅更新项目选项 JSON 不会改变旧客户端的行为。项目侧需同步维护自己的输入 Schema，并在不支持这些扩展字段的平台移除相关配置。
