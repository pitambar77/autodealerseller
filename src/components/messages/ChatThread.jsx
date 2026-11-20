// A buyer–seller conversation: message bubbles, "Seen" receipts and a reply box.
// Used by seller inboxes, the buyer's Messages page and the guest conversation page.
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, CheckCheck, Loader2, Send } from 'lucide-react';
import { useStore } from '../../store/AppStore';
import { cn } from '../../utils/format';
import { threadOf } from '../../utils/messages';

const SELLER_QUICK = ['Yes, it is still available.', 'When would you like to come and see it?', 'Can I call you to discuss?', 'The price is negotiable after inspection.'];
const BUYER_QUICK = ['Is it still available?', 'What is your best price?', 'Can I see it this weekend?', 'Are service records available?'];

const timeOf = (iso) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

/**
 * @param enquiry  the conversation (messages, readAt)
 * @param side     'seller' | 'buyer' (who is writing on this screen)
 * @param send     async (text) => updated enquiry
 * @param markRead () => void, called when new messages from the other side are on screen
 * @param otherName  shown in the empty state and receipts
 */
export function ChatThread({ enquiry, side, send, markRead, otherName = 'them', className, disabled, disabledReason }) {
  const { activeChat } = useStore() || {};
  const listRef = useRef(null);
  const [text, setText] = useState('');
  const [pending, setPending] = useState([]); // optimistic messages: { id, text, at, status: 'sending' | 'failed' }
  const [err, setErr] = useState('');
  const messages = threadOf(enquiry);
  const other = side === 'seller' ? 'buyer' : 'seller';
  const otherRead = enquiry?.readAt?.[other];
  const lastMine = [...messages].reverse().find((m) => m.from === side);
  const unseen = messages.filter((m) => m.from === other && (!enquiry?.readAt?.[side] || new Date(m.at) > new Date(enquiry.readAt[side]))).length;

  // Tell the store which conversation is on screen (no toasts for it) and mark it read.
  useEffect(() => {
    // Only a conversation the person opened counts as "on screen" (not one shown by default).
    if (!activeChat || !enquiry?.id || !markRead) return undefined;
    activeChat.current = enquiry.id;
    return () => {
      if (activeChat.current === enquiry.id) activeChat.current = null;
    };
  }, [activeChat, enquiry?.id, !!markRead]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!unseen || !markRead) return undefined;
    if (document.visibilityState === 'visible') {
      markRead();
      return undefined;
    }
    const onVis = () => document.visibilityState === 'visible' && markRead();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [unseen, markRead]);

  // Keep the newest message in view.
  const count = messages.length + pending.length;
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count, enquiry?.id]);

  const submit = async (value = text) => {
    const t = value.trim();
    if (!t) return;
    if (t.length > 2000) {
      setErr('Keep messages under 2,000 characters.');
      return;
    }
    setErr('');
    const temp = { id: `tmp_${Date.now()}`, text: t, at: new Date().toISOString(), status: 'sending' };
    setPending((p) => [...p, temp]);
    if (value === text) setText('');
    try {
      await send(t);
      setPending((p) => p.filter((m) => m.id !== temp.id));
    } catch (e) {
      setPending((p) => p.map((m) => (m.id === temp.id ? { ...m, status: 'failed' } : m)));
      setErr(e.message);
    }
  };

  // The live update can arrive before the send finishes: don't show the same message twice.
  const shownPending = pending.filter((p) => p.status === 'failed' || !messages.some((m) => m.from === side && m.text === p.text && new Date(m.at) >= new Date(p.at) - 10_000));
  const all = [...messages.map((m) => ({ ...m, mine: m.from === side })), ...shownPending.map((m) => ({ ...m, mine: true, pending: true }))];
  const quick = side === 'seller' ? SELLER_QUICK : BUYER_QUICK;
  const sentByMe = messages.some((m) => m.from === side);

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div ref={listRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain rounded-xl bg-mist-50 px-3 py-4 sm:px-4" role="log" aria-live="polite" aria-label="Conversation">
        {all.map((m, i) => {
          const prev = all[i - 1];
          const newDay = !prev || new Date(prev.at).toDateString() !== new Date(m.at).toDateString();
          const grouped = prev && !newDay && prev.mine === m.mine && new Date(m.at) - new Date(prev.at) < 5 * 60_000;
          const isLastMine = !m.pending && lastMine && m.id === lastMine.id;
          const seen = isLastMine && otherRead && new Date(otherRead) >= new Date(m.at);
          return (
            <Fragment key={m.id}>
              {newDay && (
                <p className="py-2 text-center text-[11.5px] font-semibold text-mist-500">
                  <span className="rounded-full bg-white px-2.5 py-1 shadow-card">{dayLabel(m.at)}</span>
                </p>
              )}
              <div className={cn('flex', m.mine ? 'justify-end' : 'justify-start', !grouped && 'pt-1.5')}>
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-line break-words rounded-2xl px-3.5 py-2 text-[14.5px] leading-snug sm:max-w-[75%]',
                    m.mine ? 'rounded-br-md bg-accent-600 text-white' : 'rounded-bl-md bg-white text-ink-900 shadow-card',
                    m.status === 'failed' && 'bg-bad-600',
                  )}
                >
                  {m.text}
                  <span className={cn('mt-0.5 flex items-center justify-end gap-1 text-[10.5px]', m.mine ? 'text-white/75' : 'text-mist-500')}>
                    {m.status === 'sending' ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Sending
                      </>
                    ) : m.status === 'failed' ? (
                      <button
                        type="button"
                        className="font-semibold underline"
                        onClick={() => {
                          setPending((p) => p.filter((x) => x.id !== m.id));
                          submit(m.text);
                        }}
                      >
                        Not sent · tap to retry
                      </button>
                    ) : (
                      <>
                        {timeOf(m.at)}
                        {isLastMine && (seen ? <CheckCheck className="h-3.5 w-3.5" aria-label="Seen" /> : <Check className="h-3.5 w-3.5" aria-label="Sent" />)}
                      </>
                    )}
                  </span>
                </div>
              </div>
              {isLastMine && seen && i === all.length - 1 - shownPending.length && <p className="pr-1 text-right text-[11px] text-mist-500">Seen</p>}
            </Fragment>
          );
        })}
      </div>

      {disabled ? (
        <p className="mt-3 rounded-lg bg-mist-100 px-3 py-2.5 text-center text-[13px] text-mist-600">{disabledReason || 'This conversation is closed.'}</p>
      ) : (
        <>
          {!sentByMe && (
            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
              {quick.map((q) => (
                <button key={q} type="button" onClick={() => submit(q)} className="shrink-0 rounded-full border border-mist-200 bg-white px-2.5 py-1 text-[12.5px] font-medium text-ink-700 hover:border-accent-300">
                  {q}
                </button>
              ))}
            </div>
          )}
          <form
            className="mt-2 flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <textarea
              rows={Math.min(5, Math.max(1, text.split('\n').length))}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                if (err) setErr('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  submit();
                }
              }}
              maxLength={2000}
              placeholder={`Message ${otherName}`}
              aria-label={`Message ${otherName}`}
              className="input min-h-[44px] flex-1 resize-none py-2.5"
            />
            <button type="submit" className="btn btn-primary h-11 w-11 shrink-0 p-0" disabled={!text.trim()} aria-label="Send message">
              <Send className="h-4 w-4" />
            </button>
          </form>
          {err ? <p className="field-error">{err}</p> : <p className="mt-1.5 hidden text-[11.5px] text-mist-500 sm:block">Enter to send · Shift + Enter for a new line</p>}
        </>
      )}
    </div>
  );
}
