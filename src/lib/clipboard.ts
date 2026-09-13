/**
 * Robust clipboard copy utility that works reliably across:
 * - Desktop and mobile browsers (Android Chrome, iOS Safari, etc.)
 * - Sandboxed iframes (with or without clipboard-write permission)
 * - Large text strings
 */

export interface CopyResult {
  success: boolean;
  method: 'clipboard-api' | 'execCommand' | 'failed';
  error?: string;
}

export async function copyTextToClipboard(text: string): Promise<CopyResult> {
  if (!text) {
    return { success: false, method: 'failed', error: 'No text provided to copy.' };
  }

  // 1. Try modern navigator.clipboard.writeText first if available and document is focused
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true, method: 'clipboard-api' };
    } catch {
      // Modern API rejected (common in iframes, permission policies, or mobile background tabs)
      // Fall through to fallback execCommand method
    }
  }

  // 2. Fallback: Hidden textarea with document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      
      // Ensure element is off-screen and invisible to user but focusable by browser
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '-9999px';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.setAttribute('readonly', '');
      textArea.setAttribute('aria-hidden', 'true');

      document.body.appendChild(textArea);

      // Mobile iOS/Android selection compatibility
      textArea.focus({ preventScroll: true });
      textArea.select();
      textArea.setSelectionRange(0, text.length);

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        return { success: true, method: 'execCommand' };
      }
    } catch (err) {
      // Fallback failed
      return {
        success: false,
        method: 'failed',
        error: err instanceof Error ? err.message : 'Clipboard operation failed.',
      };
    }
  }

  return {
    success: false,
    method: 'failed',
    error: 'Clipboard access is restricted by your browser. Please select and copy the text manually.',
  };
}
