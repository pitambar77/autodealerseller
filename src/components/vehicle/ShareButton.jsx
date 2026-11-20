// "Share" on a listing: the phone's own share sheet where there is one (WhatsApp, Instagram, SMS…),
// otherwise a small menu with WhatsApp, Facebook, X, email, SMS and "Copy link".
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Mail, MessageCircle, MessageSquareText, Share2 } from 'lucide-react';
import { Button, useToast } from '../ui';
import { cn } from '../../utils/format';

// Brand marks (the icon set has no brand logos).
const Facebook = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3Z" />
  </svg>
);
const XLogo = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.3 4.7H5.5l11.2 14.5Z" />
  </svg>
);

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers / non-secure pages
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

/**
 * <ShareButton title="2019 Toyota Hilux · TSh 85,000,000" path="/cars/v1001" />
 * `path` is the listing's address on this site; the full link is built from the current origin.
 */
export function ShareButton({ title, text, path, className, size = 'sm', variant = 'secondary' }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef(null);
  const toast = useToast();
  const url = typeof window !== 'undefined' ? new URL(path || window.location.pathname, window.location.origin).href : path;
  const message = text || title;

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const onShare = async () => {
    // Phones (and some desktop browsers) have a native share sheet.
    const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    if (touch && navigator.share) {
      try {
        await navigator.share({ title, text: message, url });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return; // the user closed the sheet
      }
    }
    setOpen((o) => !o);
  };

  const copy = async () => {
    const ok = await copyText(url);
    setCopied(ok);
    toast(ok ? 'Link copied. Paste it anywhere to share this listing.' : "Couldn't copy the link. Copy it from the address bar instead.", { tone: ok ? 'success' : 'error' });
    setTimeout(() => setCopied(false), 2000);
    setOpen(false);
  };

  const enc = encodeURIComponent;
  const links = [
    { label: 'WhatsApp', icon: MessageCircle, href: `https://wa.me/?text=${enc(`${message}\n${url}`)}`, tone: 'text-[#128C7E]' },
    { label: 'Facebook', icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, tone: 'text-[#1877F2]' },
    { label: 'X', icon: XLogo, href: `https://twitter.com/intent/tweet?text=${enc(message)}&url=${enc(url)}`, tone: 'text-ink-900' },
    { label: 'Email', icon: Mail, href: `mailto:?subject=${enc(title)}&body=${enc(`${message}\n\n${url}`)}`, tone: 'text-mist-700' },
    { label: 'Text message', icon: MessageSquareText, href: `sms:?&body=${enc(`${message} ${url}`)}`, tone: 'text-mist-700' },
  ];

  return (
    <div ref={box} className={cn('relative', className)}>
      <Button variant={variant} size={size} icon={Share2} onClick={onShare} aria-haspopup="menu" aria-expanded={open} className="w-full">
        Share
      </Button>
      {open && (
        <div role="menu" aria-label="Share this listing" className="absolute right-0 top-full z-30 mt-2 w-60 animate-fade-up overflow-hidden rounded-xl border border-mist-200 bg-white py-1 shadow-pop">
          {links.map(({ label, icon: Icon, href, tone }) => (
            <a key={label} role="menuitem" href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-[13.5px] font-medium text-ink-800 hover:bg-mist-50">
              <Icon className={cn('h-4 w-4', tone)} /> {label}
            </a>
          ))}
          <button type="button" role="menuitem" onClick={copy} className="flex w-full items-center gap-3 border-t border-mist-100 px-4 py-2.5 text-left text-[13.5px] font-semibold text-ink-800 hover:bg-mist-50">
            {copied ? <Check className="h-4 w-4 text-ok-600" /> : <Copy className="h-4 w-4 text-mist-600" />} Copy link
          </button>
        </div>
      )}
    </div>
  );
}
