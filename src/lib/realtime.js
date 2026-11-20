// Live updates from the API (Server-Sent Events on GET /api/events).
// Uses fetch rather than EventSource so the sign-in token travels in a header, not in the URL.
// Reconnects by itself (1 s, 2 s, 4 s … up to 30 s) and straight away when the tab becomes visible.
import { API_URL, getToken } from './api';

/**
 * connectEvents({ onEvent(name, data), onStatus(status) , query })
 * status: 'connecting' | 'open' | 'reconnecting' | 'closed'
 * Returns a function that closes the connection.
 */
export function connectEvents({ onEvent, onStatus, query = '' }) {
  let stopped = false;
  let ctrl = null;
  let delay = 1000;
  let timer = null;
  let opened = 0; // how many times the stream opened (the first open isn't a "reconnect")

  const status = (s) => onStatus?.(s, opened);

  async function run() {
    if (stopped) return;
    ctrl = new AbortController();
    status(opened ? 'reconnecting' : 'connecting');
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/api/events${query ? `?${query}` : ''}`, {
        headers: { Accept: 'text/event-stream', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        cache: 'no-store',
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      opened += 1;
      delay = 1000;
      status('open');
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          let event = 'message';
          const data = [];
          block.split('\n').forEach((line) => {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
          });
          if (!data.length) continue; // comment / keep-alive
          try {
            onEvent?.(event, JSON.parse(data.join('\n')));
          } catch {
            /* ignore a malformed event */
          }
        }
      }
    } catch {
      /* network error or aborted */
    }
    if (stopped) return;
    status('reconnecting');
    timer = setTimeout(run, delay);
    delay = Math.min(delay * 2, 30_000);
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible' && timer) {
      clearTimeout(timer);
      timer = null;
      delay = 1000;
      run();
    }
  };
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
  run();

  return () => {
    stopped = true;
    clearTimeout(timer);
    ctrl?.abort();
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    status('closed');
  };
}

/** Desktop alert while the tab is in the background (only if the visitor allowed notifications). */
export function desktopAlert(title, body, url) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
    const n = new Notification(title, { body, icon: '/favicon.ico', tag: url || title });
    n.onclick = () => {
      window.focus();
      if (url) window.location.assign(url);
      n.close();
    };
  } catch {
    /* not supported */
  }
}
