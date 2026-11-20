// Editor for banner headings: type the text, press Enter for a new line, select words and click a colour.
// The value is a list of text pieces ({ text, color? }, "\n" = line break; see config/heading.js).
// The editable area is rebuilt from that list with DOM text nodes (never innerHTML), so pasted or typed
// markup stays plain text.
import { useCallback, useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Eraser, Palette } from 'lucide-react';
import { HEADING_COLORS } from '../../config/heading';
import { cn } from '../../utils/format';

// ── the list of pieces ⇄ a list of characters with colours
const toChars = (segs) => (segs || []).flatMap((s) => String(s.text || '').split('').map((ch) => ({ ch, color: s.color || '' })));
function toSegs(chars) {
  const out = [];
  for (const c of chars) {
    const last = out[out.length - 1];
    if (last && (last.color || '') === c.color) last.text += c.ch;
    else out.push(c.color ? { text: c.ch, color: c.color } : { text: c.ch });
  }
  return out;
}
const colorAt = (chars, i) => chars[Math.max(0, i - 1)]?.color || chars[i]?.color || '';

// ── reading the editable area
function serialize(root) {
  const segs = [];
  const push = (text, color) => text && segs.push(color ? { text, color } : { text });
  const walk = (node, color) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) push(child.nodeValue.replace(/ /g, ' '), color);
      else if (child.nodeName === 'BR') {
        if (!child.dataset?.tail) push('\n', color);
      } else if (child.nodeType === 1 || child.nodeType === 11) {
        const c = child.dataset?.color ?? color;
        // Browsers sometimes wrap new lines in <div>/<p>: treat each as a line break.
        if (/^(DIV|P)$/.test(child.nodeName) && segs.length) push('\n', c);
        walk(child, c);
      }
    });
  };
  walk(root, '');
  return toSegs(toChars(segs));
}

/** Character offset of a DOM position inside the editor. */
function offsetOf(root, container, offset) {
  const r = document.createRange();
  r.setStart(root, 0);
  r.setEnd(container, offset);
  const frag = r.cloneContents();
  return serialize(frag).reduce((n, s) => n + s.text.length, 0);
}

/** DOM position for a character offset. */
function positionOf(root, target) {
  let count = 0;
  let found = null;
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (found) return;
      if (child.nodeType === 3) {
        const len = child.nodeValue.length;
        if (target <= count + len) return (found = [child, target - count]);
        count += len;
      } else if (child.nodeName === 'BR') {
        if (child.dataset?.tail) continue;
        if (target <= count) return (found = [child.parentNode, [...child.parentNode.childNodes].indexOf(child)]);
        count += 1;
      } else walk(child);
    }
  };
  walk(root);
  if (found) return found;
  const tail = root.querySelector('br[data-tail]');
  return tail ? [tail.parentNode, [...tail.parentNode.childNodes].indexOf(tail)] : [root, root.childNodes.length];
}

/** Rebuilds the editable area from the pieces (text nodes and <br>s only). */
function render(root, segs) {
  root.replaceChildren();
  (segs || []).forEach((s) => {
    let host = root;
    if (s.color) {
      host = document.createElement('span');
      host.style.color = s.color;
      host.setAttribute('data-color', s.color);
    }
    String(s.text)
      .split('\n')
      .forEach((part, j) => {
        if (j > 0) host.appendChild(document.createElement('br'));
        if (part) host.appendChild(document.createTextNode(part));
      });
    if (host !== root) root.appendChild(host);
  });
  // A heading that ends with a line break needs one more <br> so the caret can sit on the new line.
  if (String(segs?.[segs.length - 1]?.text || '').endsWith('\n')) {
    const tail = document.createElement('br');
    tail.setAttribute('data-tail', '1');
    root.appendChild(tail);
  }
}

export function HeadingEditor({ id, value, onChange, placeholder = 'Type the heading…', error, className }) {
  const box = useRef(null);
  const emitted = useRef(null); // JSON of the last value we sent up, to tell our own edits from outside changes
  const lastSel = useRef(null); // { start, end } of the last selection inside the editor
  const [hasSel, setHasSel] = useState(false);

  useEffect(() => {
    const json = JSON.stringify(value || []);
    if (json !== emitted.current && box.current) {
      render(box.current, value);
      emitted.current = json;
    }
  }, [value]);

  const emit = useCallback(
    (segs) => {
      emitted.current = JSON.stringify(segs);
      onChange(segs);
    },
    [onChange],
  );

  // Remember the selection, so colour buttons (and the colour picker, which takes focus) know what to change.
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      if (!sel?.rangeCount || !box.current) return;
      const r = sel.getRangeAt(0);
      if (!box.current.contains(r.startContainer) || !box.current.contains(r.endContainer)) return;
      const start = offsetOf(box.current, r.startContainer, r.startOffset);
      const end = offsetOf(box.current, r.endContainer, r.endOffset);
      lastSel.current = { start: Math.min(start, end), end: Math.max(start, end) };
      setHasSel(start !== end);
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  /** The selection right now if it is in the editor (typing moves it faster than selectionchange
   *  reports), else the last one we saw (a colour picker takes focus away). */
  const currentSel = () => {
    const sel = window.getSelection();
    const root = box.current;
    if (sel?.rangeCount && root) {
      const r = sel.getRangeAt(0);
      if (root.contains(r.startContainer) && root.contains(r.endContainer)) {
        const a = offsetOf(root, r.startContainer, r.startOffset);
        const b = offsetOf(root, r.endContainer, r.endOffset);
        return { start: Math.min(a, b), end: Math.max(a, b) };
      }
    }
    return lastSel.current;
  };

  const select = (start, end = start) => {
    const root = box.current;
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStart(...positionOf(root, start));
    r.setEnd(...positionOf(root, end));
    sel.removeAllRanges();
    sel.addRange(r);
  };

  /** Replace the selection with `text` (Enter, paste, the line-break button). */
  const insert = (text, at = currentSel()) => {
    const chars = toChars(serialize(box.current));
    const { start, end } = at || { start: chars.length, end: chars.length };
    const color = colorAt(chars, start);
    chars.splice(start, end - start, ...text.split('').map((ch) => ({ ch, color })));
    const segs = toSegs(chars);
    render(box.current, segs);
    emit(segs);
    box.current.focus();
    select(start + text.length);
  };

  const paint = (color) => {
    const at = currentSel();
    if (!at || at.start === at.end) return;
    const chars = toChars(serialize(box.current)).map((c, i) => (i >= at.start && i < at.end ? { ...c, color } : c));
    const segs = toSegs(chars);
    render(box.current, segs);
    emit(segs);
    box.current.focus();
    select(at.start, at.end);
  };

  const keep = (e) => e.preventDefault(); // toolbar buttons must not take the selection away

  return (
    <div className={cn('overflow-hidden rounded-xl border', error ? 'border-bad-500' : 'border-mist-200', className)}>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-mist-200 bg-mist-50 px-2.5 py-2">
        <span className="mr-1 flex items-center gap-1 text-[12px] font-semibold text-mist-600">
          <Palette className="h-3.5 w-3.5" /> Colour of selected words:
        </span>
        {HEADING_COLORS.map((c) => (
          <button
            key={c.label}
            type="button"
            onMouseDown={keep}
            onClick={() => paint(c.value)}
            disabled={!hasSel}
            title={c.label}
            aria-label={`Make the selected words ${c.label.toLowerCase()}`}
            className="h-6 w-6 rounded-full border border-mist-300 shadow-sm transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
            style={{ background: c.value || '#FFFFFF' }}
          />
        ))}
        <label className={cn('relative flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-mist-300 bg-[conic-gradient(red,yellow,lime,cyan,blue,magenta,red)] shadow-sm', !hasSel && 'pointer-events-none opacity-40')} title="Another colour">
          <span className="sr-only">Pick another colour for the selected words</span>
          <input type="color" className="absolute inset-0 cursor-pointer opacity-0" disabled={!hasSel} onChange={(e) => paint(e.target.value.toUpperCase())} />
        </label>
        <button type="button" onMouseDown={keep} onClick={() => paint('')} disabled={!hasSel} className="ml-1 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold text-mist-600 hover:bg-mist-100 disabled:opacity-40" aria-label="Remove the colour from the selected words">
          <Eraser className="h-3.5 w-3.5" /> Clear
        </button>
        <span className="flex-1" />
        <button type="button" onMouseDown={keep} onClick={() => insert('\n')} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold text-mist-600 hover:bg-mist-100" aria-label="Insert a line break">
          <CornerDownLeft className="h-3.5 w-3.5" /> New line
        </button>
      </div>
      <div
        id={id}
        ref={box}
        role="textbox"
        aria-multiline="true"
        aria-label="Banner heading"
        contentEditable
        suppressContentEditableWarning
        spellCheck
        data-placeholder={placeholder}
        className="min-h-[96px] whitespace-pre-wrap break-words bg-[#13282D] px-4 py-3 font-display text-[26px] font-extrabold leading-[1.15] tracking-tight text-white outline-none empty:before:text-white/35 empty:before:content-[attr(data-placeholder)] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-400"
        onInput={() => emit(serialize(box.current))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            insert('\n');
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          insert(e.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n'));
        }}
        onDrop={(e) => e.preventDefault()}
      />
      <p className="border-t border-mist-200 bg-mist-50 px-3 py-1.5 text-[12px] text-mist-500">Press Enter for a new line. Select words, then click a colour.</p>
    </div>
  );
}
