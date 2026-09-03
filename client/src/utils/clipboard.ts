/**
 * 复制文本到剪贴板。
 * navigator.clipboard 仅在安全上下文（HTTPS / localhost）可用，
 * 部署在 http://<ip>/ 时会抛错或被拒 → 降级 execCommand 并如实返回成败。
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 权限被拒或非安全上下文，落到下方降级
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
