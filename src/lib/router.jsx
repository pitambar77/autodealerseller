'use client';
// The screens were written for react-router. This module gives them the same API
// (Link, NavLink, Outlet, Navigate, useNavigate, useParams, useSearchParams, useLocation)
// on top of the Next.js App Router, so every screen keeps working unchanged.
import { createContext, forwardRef, useCallback, useContext, useEffect, useMemo } from 'react';
import NextLink from 'next/link';
import { useParams as useNextParams, usePathname, useRouter, useSearchParams as useNextSearchParams } from 'next/navigation';

// ── Navigation state (react-router's `navigate(to, { state })`)
const STATE_KEY = 'autodealer-nav-state';
let navState = { path: null, state: null };
const pathOf = (to) => String(to).split(/[?#]/)[0];
function saveNavState(to, state) {
  navState = { path: pathOf(to), state: state ?? null };
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(navState));
  } catch {
    /* ignore */
  }
}
function readNavState(pathname) {
  if (navState.path === null) {
    try {
      navState = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null') || navState;
    } catch {
      /* ignore */
    }
  }
  return navState.path === pathname ? navState.state : null;
}

const hrefOf = (to) => {
  if (to && typeof to === 'object') return `${to.pathname || ''}${to.search || ''}${to.hash || ''}`;
  return to ?? '';
};

// ── Outlet: layouts render <Outlet />; the Next.js layout passes the page in through context.
const OutletCtx = createContext(null);
export function OutletProvider({ value, children }) {
  return <OutletCtx.Provider value={value}>{children}</OutletCtx.Provider>;
}
export function Outlet() {
  return useContext(OutletCtx);
}

// ── Links
export const Link = forwardRef(function Link({ to, href, replace, state, onClick, reloadDocument, ...rest }, ref) {
  const target = hrefOf(to ?? href);
  const external = /^(https?:|mailto:|tel:)/.test(target);
  if (external || reloadDocument) return <a ref={ref} href={target} onClick={onClick} {...rest} />;
  return (
    <NextLink
      ref={ref}
      href={target}
      replace={replace}
      onClick={(e) => {
        if (state !== undefined) saveNavState(target, state);
        onClick?.(e);
      }}
      {...rest}
    />
  );
});

/** Same matching as react-router: active on the path itself and below it (unless `end`). */
export function isActivePath(pathname, to, end) {
  const p = pathOf(hrefOf(to)).replace(/\/$/, '') || '/';
  const cur = pathname.replace(/\/$/, '') || '/';
  if (cur === p) return true;
  if (end || p === '/') return false;
  return cur.startsWith(p) && cur.charAt(p.length) === '/';
}

export const NavLink = forwardRef(function NavLink({ to, end, className, style, children, ...rest }, ref) {
  const pathname = usePathname() || '/';
  const isActive = isActivePath(pathname, to, end);
  const args = { isActive, isPending: false };
  return (
    <Link
      ref={ref}
      to={to}
      aria-current={isActive ? 'page' : undefined}
      className={typeof className === 'function' ? className(args) : className}
      style={typeof style === 'function' ? style(args) : style}
      {...rest}
    >
      {typeof children === 'function' ? children(args) : children}
    </Link>
  );
});

// ── Hooks
export function useNavigate() {
  const router = useRouter();
  return useCallback(
    (to, opts = {}) => {
      if (typeof to === 'number') {
        if (to < 0) router.back();
        else router.forward();
        return;
      }
      const target = hrefOf(to);
      saveNavState(target, opts.state);
      if (opts.replace) router.replace(target, { scroll: opts.preventScrollReset ? false : true });
      else router.push(target, { scroll: opts.preventScrollReset ? false : true });
    },
    [router],
  );
}

export function useParams() {
  const p = useNextParams() || {};
  return useMemo(() => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Array.isArray(v) ? v.join('/') : decodeURIComponent(v)])), [p]);
}

/** react-router style: [searchParams, setSearchParams]. Changing the query never scrolls the page. */
export function useSearchParams() {
  const sp = useNextSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const params = useMemo(() => new URLSearchParams(sp?.toString() || ''), [sp]);
  const setParams = useCallback(
    (next, opts = {}) => {
      const value = typeof next === 'function' ? next(new URLSearchParams(params)) : next;
      const qs = new URLSearchParams(value instanceof URLSearchParams ? value : Object.entries(value || {}).filter(([, v]) => v != null)).toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (opts.replace) router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [params, pathname, router],
  );
  return [params, setParams];
}

export function useLocation() {
  const pathname = usePathname() || '/';
  const sp = useNextSearchParams();
  const search = sp?.toString() ? `?${sp.toString()}` : '';
  return useMemo(() => ({ pathname, search, hash: '', state: readNavState(pathname), key: pathname + search }), [pathname, search]);
}

/** Redirect while rendering (react-router's <Navigate />). */
export function Navigate({ to, replace = false, state }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace, state });
  }, [navigate, to, replace, state]);
  return null;
}
