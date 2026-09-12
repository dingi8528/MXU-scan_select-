/** 与运行日志面板共用时间格式；纯文本文件保留消息换行，不包含调试元数据。 */
export function formatRuntimeLogTime(date: Date, locale?: string): string {
  return date.toLocaleTimeString(locale || undefined, {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function runtimeLogText(log: { message: string; html?: string }): string {
  if (!log.html) return log.message;

  // template 内容始终保持惰性，不加载图片，也不执行富文本中的脚本。
  const template = document.createElement('template');
  template.innerHTML = log.html;
  const doc = template.content;
  doc.querySelectorAll('script, style, template, [hidden]').forEach((node) => node.remove());
  doc.querySelectorAll('img').forEach((node) => {
    node.replaceWith(document.createTextNode(node.getAttribute('alt') || ''));
  });
  doc.querySelectorAll('br').forEach((node) => node.replaceWith(document.createTextNode('\n')));
  doc
    .querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6, pre, blockquote, tr')
    .forEach((node) => {
      node.appendChild(document.createTextNode('\n'));
    });
  doc.querySelectorAll('td, th').forEach((node) => node.appendChild(document.createTextNode('\t')));
  return (doc.textContent || '').trim();
}

export function formatRuntimeLogLine(
  log: { timestamp: Date; message: string; html?: string },
  locale?: string,
): string {
  return `[${formatRuntimeLogTime(log.timestamp, locale)}] ${runtimeLogText(log)}\n`;
}
