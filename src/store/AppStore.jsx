'use client';
// Application store, backed by the AutoDealer API (autodealer-api).
// Screens read `state` (same shape as before) and call the actions below. Actions send the change
// to the API and then apply what the server returned, so the screen always shows saved data.
// Compare and recently-viewed lists stay in the browser; saved vehicles, saved searches and buyer
// preferences live in the account once the buyer signs in (in the browser before that).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, getToken, setToken } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { setCategories } from '../data/vehicleTypes';
import { setCities } from '../data/catalog';
import { allows } from '../config/permissions';
import { connectEvents, desktopAlert } from '../lib/realtime';
import { inboxPath } from '../utils/messages';

const Ctx = createContext(null);
const LOCAL_KEY = 'autodealer-local-v1';
const FE_KEYS = 'autodealer-finance-keys';
const CHAT_KEYS = 'autodealer-chat-keys';

/** Listing statuses that count as "active" for the one-listing rule and duplicate checks. */
export const ACTIVE_STATUSES = ['live', 'pending_payment', 'draft', 'suspended'];

const EMPTY = {
  config: { loanProviders: [], paymentGateway: {}, otpProvider: {}, email: {} },
  session: null,
  categories: [],
  users: [],
  vehicles: [],
  enquiries: [],
  payments: [],
  documents: [],
  notes: [],
  referrals: [],
  notifications: [],
  handovers: [],
  audit: [],
  saved: [],
  savedSearches: [],
  buyerPrefs: {},
  compare: [],
  recent: [],
  demo: { login: false, reset: false },
};

const LOCAL_FIELDS = ['compare', 'recent', 'saved', 'savedSearches', 'buyerPrefs'];
function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}') || {};
  } catch {
    return {};
  }
}
function writeLocal(s, signedIn) {
  try {
    // Signed-in buyers keep saved items in their account; only device lists are stored here then.
    const prev = readLocal();
    const keep = signedIn ? { ...prev, compare: s.compare, recent: s.recent } : Object.fromEntries(LOCAL_FIELDS.map((k) => [k, s[k]]));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(keep));
  } catch {
    /* storage unavailable */
  }
}

export function financeKey(id) {
  try {
    return JSON.parse(localStorage.getItem(FE_KEYS) || '{}')[id] || null;
  } catch {
    return null;
  }
}
function rememberFinanceKey(id, key) {
  try {
    const all = JSON.parse(localStorage.getItem(FE_KEYS) || '{}');
    all[id] = key;
    localStorage.setItem(FE_KEYS, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

/** Guest buyers' conversations on this device: { [enquiryId]: { key, vehicleId, at } } */
export function chatKeys() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_KEYS) || '{}') || {};
  } catch {
    return {};
  }
}
export function rememberChatKey(id, key, vehicleId) {
  try {
    localStorage.setItem(CHAT_KEYS, JSON.stringify({ ...chatKeys(), [id]: { key, vehicleId, at: new Date().toISOString() } }));
  } catch {
    /* ignore */
  }
}

// ── Why the last session ended (shown once on the sign-in page).
const SIGNOUT_KEY = 'autodealer-signout-reason';
function rememberSignOut(reason) {
  try {
    sessionStorage.setItem(SIGNOUT_KEY, reason);
  } catch {
    /* ignore */
  }
}
/** Read (and forget) why the last session ended, e.g. after the admin idle timeout. */
export function takeSignOutReason() {
  try {
    const r = sessionStorage.getItem(SIGNOUT_KEY);
    sessionStorage.removeItem(SIGNOUT_KEY);
    return r || '';
  } catch {
    return '';
  }
}

// ── Last loaded data, per browser tab (sessionStorage): lets a reload paint instantly.
const BOOT_KEY = 'autodealer-boot';
const tokenTag = (t) => (t ? `${t.length}:${t.slice(-24)}` : 'guest');
function readBoot(token) {
  try {
    const c = JSON.parse(sessionStorage.getItem(BOOT_KEY) || 'null');
    return c && c.tag === tokenTag(token) && Date.now() - c.at < 30 * 60_000 ? c.data : null;
  } catch {
    return null;
  }
}
function writeBoot(token, data) {
  try {
    if (!data) return sessionStorage.removeItem(BOOT_KEY);
    const json = JSON.stringify({ tag: tokenTag(token), at: Date.now(), data });
    if (json.length < 3_000_000) sessionStorage.setItem(BOOT_KEY, json);
    else sessionStorage.removeItem(BOOT_KEY);
  } catch {
    /* storage full or blocked: just load normally next time */
  }
}

const upsert = (list, rec) => (rec ? (list.some((x) => x.id === rec.id) ? list.map((x) => (x.id === rec.id ? { ...x, ...rec } : x)) : [rec, ...list]) : list);
const upsertMany = (list, recs = []) => recs.reduce(upsert, list);

export function StoreProvider({ children }) {
  const [state, setState] = useState(EMPTY);
  // The admin's city list (Admin → Configuration → Cities) feeds every city picker. Runs while
  // rendering, before the screens below read CITIES.
  useMemo(() => setCities(state.config?.cities), [state.config?.cities]);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState(null);
  const ref = useRef(state);
  ref.current = state;
  const regToken = useRef(null);
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const signedIn = !!state.session;
  useEffect(() => {
    if (status === 'ready') writeLocal(state, signedIn);
  }, [state, signedIn, status]);

  /** Put loaded data on screen. */
  const apply = useCallback((data) => {
    setCategories(data.categories || []); // vehicle categories managed in Admin → Categories
    const local = readLocal();
    setState((s) => ({
      ...EMPTY,
      ...data,
      compare: local.compare || s.compare || [],
      recent: local.recent || s.recent || [],
      ...(data.session ? {} : { saved: local.saved || [], savedSearches: local.savedSearches || [], buyerPrefs: local.buyerPrefs || {} }),
    }));
    // Lists that screens read directly are always lists, even if a saved record lacks them.
    setState((s) => ({ ...s, buyerPrefs: { ...s.buyerPrefs, bodies: Array.isArray(s.buyerPrefs?.bodies) ? s.buyerPrefs.bodies : [], fuels: Array.isArray(s.buyerPrefs?.fuels) ? s.buyerPrefs.fuels : [] } }));
    setStatus('ready');
  }, []);

  /** Load everything for the current visitor. */
  const refresh = useCallback(async (opts = {}) => {
    try {
      const data = await api('GET', '/bootstrap', undefined, { passive: !!opts.passive });
      if (!data.session && getToken()) {
        setToken(null); // expired, ended or idle sign-in
        // Say why on the next screen (e.g. "signed out after a period of inactivity").
        if (data.authError) {
          rememberSignOut(data.authError);
          toastRef.current?.(data.authError, { tone: 'notice', title: 'Signed out' });
        }
      }
      apply(data);
      setLoadError(null);
      // Admin data (everyone's records) is never kept in the browser.
      if (data.session?.role !== 'admin') writeBoot(data.session ? getToken() : null, data);
      else writeBoot(null, null);
      return data;
    } catch (e) {
      // An expired token: drop it and load as a guest.
      if (e instanceof ApiError && e.status === 401 && getToken()) {
        setToken(null);
        return refresh();
      }
      setLoadError(e.message);
      setStatus((st) => (st === 'ready' ? st : 'error'));
      throw e;
    }
  }, [apply]);

  useEffect(() => {
    // Show the data from this tab's last visit straight away (no loading spinner on reload or a
    // new page), then bring it up to date in the background.
    const cached = readBoot(getToken());
    if (cached) apply(cached);
    refresh().catch(() => {});
  }, [refresh, apply]);

  // ── Live updates: new enquiries and messages, notifications and listing changes arrive without reloading.
  const [live, setLive] = useState('connecting');
  /** The conversation open on screen (its messages don't need a toast). */
  const activeChat = useRef(null);
  const sessionUser = state.session?.userId || null;
  useEffect(() => {
    if (status !== 'ready') return undefined;
    // Several events in a row (e.g. a document upload) cause one reload, not several.
    let soon = null;
    const refreshSoon = () => {
      clearTimeout(soon);
      soon = setTimeout(() => refresh({ passive: true }).catch(() => {}), 600);
    };
    const onEvent = (name, data) => {
      const cur = ref.current;
      const me = cur.session?.userId;
      if (['enquiry', 'message', 'read'].includes(name) && data.enquiry) {
        const e = data.enquiry;
        if (e.sellerId !== me && e.buyerId !== me) return; // a guest page's own stream handles its conversation
        setState((s) => ({ ...s, enquiries: s.enquiries.some((x) => x.id === e.id) ? s.enquiries.map((x) => (x.id === e.id ? e : x)) : [e, ...s.enquiries] }));
        const side = e.sellerId === me ? 'seller' : 'buyer';
        const fromOther = name === 'enquiry' ? side === 'seller' : name === 'message' && data.message?.from !== side;
        if (fromOther && activeChat.current !== e.id) {
          const v = cur.vehicles.find((x) => x.id === e.vehicleId);
          const who = side === 'seller' ? e.buyerName : (cur.users.find((u) => u.id === e.sellerId) || {}).business || (cur.users.find((u) => u.id === e.sellerId) || {}).name || 'The seller';
          const text = data.message?.text || e.message;
          const href = side === 'seller' ? inboxPath(cur.session?.role, e.id) : `/buyer/messages?c=${e.id}`;
          const title = name === 'enquiry' ? `New enquiry from ${who}` : `${who}${v ? ` · ${v.make} ${v.model}` : ''}`;
          toastRef.current?.(text, { tone: 'message', title, href, actionLabel: 'Reply', duration: 7000 });
          desktopAlert(title, text, href);
        }
      } else if (name === 'notification' && data.notification) {
        const n = data.notification;
        setState((s) => ({ ...s, notifications: [n, ...s.notifications.filter((x) => x.id !== n.id)] }));
        // Pop-up for things worth seeing straight away: saved-vehicle changes, review results, admin to-dos.
        if (/^(saved_|doc_|listing_)|^(registration|document|listing)$/.test(String(n.kind || ''))) {
          toastRef.current?.(n.body, { tone: 'notice', title: n.title, href: n.link, actionLabel: 'View', duration: 7000 });
          desktopAlert(n.title, n.body, n.link);
        }
        // A review result changes my documents/listing status: reload my data quietly.
        if (/^(doc_|listing_)/.test(String(n.kind || ''))) refreshSoon();
      } else if (name === 'views' && data.id) {
        setState((s) => (s.vehicles.some((x) => x.id === data.id) ? { ...s, vehicles: s.vehicles.map((x) => (x.id === data.id ? { ...x, views: data.views } : x)) } : s));
      } else if (name === 'admin_refresh') {
        refreshSoon(); // new registration or document: the admin console's lists update without a reload
      } else if (name === 'vehicle' && data.vehicle) {
        const v = data.vehicle;
        // Sellers and admins hold the full record; ignore the public copy of it.
        if (data.scope === 'public' && (v.sellerId === me || cur.session?.role === 'admin')) return;
        if (data.scope === 'public' && !cur.vehicles.some((x) => x.id === v.id) && v.status !== 'live') return;
        setState((s) => ({ ...s, vehicles: upsert(s.vehicles, v) }));
      }
    };
    const stop = connectEvents({
      onEvent,
      onStatus: (st, opened) => {
        setLive(st);
        // Back after a dropped connection: catch up on anything missed meanwhile.
        if (st === 'open' && opened > 1) refresh().catch(() => {});
      },
    });
    return () => {
      clearTimeout(soon);
      stop();
    };
  }, [status, sessionUser, refresh]);

  // Admin staff: sign out after the idle time set in Admin → Security (the API enforces it too).
  const adminIdle = state.session?.role === 'admin' ? state.session.idleMinutes || 30 : 0;
  useEffect(() => {
    if (!adminIdle) return undefined;
    const idleMs = adminIdle * 60_000;
    let last = Date.now();
    let lastPing = Date.now();
    let warned = false;
    const bump = () => {
      last = Date.now();
      warned = false;
    };
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    const timer = setInterval(() => {
      const idle = Date.now() - last;
      if (idle >= idleMs) {
        clearInterval(timer);
        rememberSignOut(`You were signed out after ${adminIdle} minutes without activity. Sign in again to continue.`);
        api('POST', '/me/signout').catch(() => {});
        setToken(null);
        window.location.assign('/admin/login');
        return;
      }
      if (!warned && idle >= idleMs - 60_000) {
        warned = true;
        toastRef.current?.('Move the mouse or press a key to stay signed in.', { tone: 'notice', title: "You'll be signed out in 1 minute", duration: 55_000 });
      }
      // Reading a page makes no requests: tell the API this person is still here.
      if (idle < 60_000 && Date.now() - lastPing > 4 * 60_000) {
        lastPing = Date.now();
        api('POST', '/me/ping').catch(() => {});
      }
    }, 10_000);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, bump));
    };
  }, [adminIdle]);

  const actions = useMemo(() => {
    const set = (fn) => setState((s) => ({ ...s, ...fn(s) }));
    const meId = () => ref.current.session?.userId;
    /**
     * For quick actions the screen has already applied (and confirmed with a toast): send to the API in
     * the background. If the server refuses, say why and reload the saved data. Never throws.
     */
    const quietly = (promise) =>
      promise.catch((e) => {
        toastRef.current?.(e.message, { tone: 'error', title: "That change wasn't saved" });
        refresh().catch(() => {});
        return undefined;
      });
    const patchVehicle = (id, patch) => set((s) => ({ vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));

    /** Start a session from an API sign-in result ({ token, user }). */
    async function startSession({ token, user }) {
      const guest = readLocal();
      setToken(token);
      if (user?.role === 'buyer' && guest.saved?.length) await api('POST', '/me/saved/merge', { ids: guest.saved }).catch(() => {});
      await refresh();
      return user;
    }

    return {
      refresh,
      startSession,

      async reset() {
        await api('POST', '/demo/reset');
        try {
          localStorage.removeItem(LOCAL_KEY);
        } catch {
          /* ignore */
        }
        setToken(null);
        setState((s) => ({ ...s, compare: [], recent: [] }));
        await refresh();
      },

      // ── Session
      /** Demo navigator: sign in as a seeded account (only when the API allows demo sign-in). If that account is already signed in, just reload. */
      async login(userId) {
        if (meId() === userId) return refresh();
        const res = await api('POST', '/auth/demo-login', { userId });
        return startSession(res);
      },
      logout() {
        api('POST', '/me/signout').catch(() => {}); // end the session on the server too
        setToken(null);
        regToken.current = null;
        set(() => ({ session: null }));
        refresh().catch(() => {});
      },
      /** Is this number registered? → { registered, role, status } or null */
      async findUserByPhone(phone) {
        const r = await api('POST', '/auth/phone-status', { phone });
        return r.registered ? { phone, role: r.role, status: r.status } : null;
      },
      /** Send a one-time code. Returns { sent, devCode? } (devCode only in development). */
      requestOtp(phone) {
        return api('POST', '/auth/otp/request', { phone });
      },
      /**
       * Check a code. Registered number → signed in, returns { registered: true, user }.
       * New number → returns { registered: false } and remembers the proof for registerUser().
       */
      async verifyOtp(phone, code) {
        const r = await api('POST', '/auth/otp/verify', { phone, code });
        if (!r.registered) {
          regToken.current = r.registrationToken;
          try {
            sessionStorage.setItem('autodealer-reg', r.registrationToken);
          } catch {
            /* ignore */
          }
          return { registered: false };
        }
        const user = await startSession(r);
        return { registered: true, user, member: r.member || null };
      },
      /** Create the account for the number verified with verifyOtp(). Signs in; returns the new user. */
      async registerUser({ role, ...profile }) {
        let token = regToken.current;
        if (!token) {
          try {
            token = sessionStorage.getItem('autodealer-reg');
          } catch {
            /* ignore */
          }
        }
        const res = await api('POST', '/auth/register', { registrationToken: token, role, ...profile });
        regToken.current = null;
        try {
          sessionStorage.removeItem('autodealer-reg');
        } catch {
          /* ignore */
        }
        setToken(res.token);
        set((s) => ({ users: upsert(s.users, res.user), session: { userId: res.user.id, role: res.user.role, at: new Date().toISOString() } }));
        return res.user;
      },
      /** Staff sign-in. Returns { needsTotp } or { needsTotpSetup, setupToken, secret, otpauthUrl } or { user }. */
      async adminLogin({ email, password, totp }) {
        const res = await api('POST', '/auth/admin/login', { email, password, totp });
        if (res.needsTotp) return { needsTotp: true };
        if (res.needsTotpSetup) return res;
        return { user: await startSession(res) };
      },
      /** Finish setting up 2-step verification at sign-in. */
      async adminTotpSetup(setupToken, totp) {
        return { user: await startSession(await api('POST', '/auth/admin/login/totp-setup', { setupToken, totp })) };
      },
      checkInvite(code, email) {
        return api('POST', '/auth/admin/invite/check', { code, email });
      },
      async acceptInvite(data) {
        return startSession(await api('POST', '/auth/admin/invite/accept', data));
      },
      async updateUser(_id, patch) {
        const { user } = await api('PATCH', '/me', patch);
        set((s) => ({ users: upsert(s.users, user) }));
        return user;
      },
      async changePhone(phone, code) {
        const { user } = await api('POST', '/me/phone', { phone, code });
        set((s) => ({ users: upsert(s.users, user) }));
        return user;
      },
      /** Sign out other devices (this one stays signed in). */
      async revokeSessions() {
        return api('POST', '/me/sessions/revoke');
      },
      /** Ask to close the account: listings are hidden now; signing in within 7 days cancels it. */
      async closeAccount() {
        await api('POST', '/me/close');
        setToken(null);
        set(() => ({ session: null }));
        await refresh();
      },
      /** Reactivate an account, or (status 'suspended') ask for a suspension: that needs another admin's approval. */
      async setUserStatus(id, status, note) {
        if (status === 'suspended') {
          const r = await api('POST', `/admin/users/${id}/status`, { status, note });
          refresh({ passive: true }).catch(() => {});
          return r;
        }
        set((s) => ({ users: s.users.map((u) => (u.id === id ? { ...u, status } : u)) }));
        return quietly(
          api('POST', `/admin/users/${id}/status`, { status, note }).then((r) => {
            set((s) => ({ users: upsert(s.users, r.user), vehicles: upsertMany(s.vehicles, r.vehicles) }));
            refresh().catch(() => {});
          }),
        );
      },
      async inviteAdmin(email, team) {
        const r = await api('POST', '/admin/invites', { email, team });
        refresh().catch(() => {});
        return r;
      },

      // ── Listings
      /** Other active listings with this registration number or VIN. */
      async findDuplicates(data, excludeId) {
        const { duplicates } = await api('POST', '/vehicles/duplicate-check', { regNumber: data.regNumber || '', vin: data.vin || '', excludeId });
        return duplicates;
      },
      /**
       * Vehicle details from the official registry (TRA) for the listing form's first step.
       * → { status: 'found' | 'not_found' | 'unavailable', source, vehicle, message }
       */
      lookupVehicle({ regNumber = '', vin = '' }) {
        const q = new URLSearchParams({ reg: regNumber, vin });
        return api('GET', `/vehicles/lookup?${q}`);
      },
      /** Create (no id) or update a listing. Returns its id. */
      async saveListing(data, id) {
        const { vehicle } = id ? await api('PATCH', `/vehicles/${id}`, data) : await api('POST', '/vehicles', data);
        set((s) => ({ vehicles: upsert(s.vehicles, vehicle) }));
        return vehicle.id;
      },
      /** Checks details, documents and duplicates. Returns { ok, duplicates, problems }. Never publishes without payment. */
      async submitListing(id) {
        const r = await api('POST', `/vehicles/${id}/submit`, undefined, { accept: [422] });
        if (r.vehicle) set((s) => ({ vehicles: upsert(s.vehicles, r.vehicle) }));
        return { ok: !!r.ok, duplicates: r.duplicates || [], problems: r.problems || [] };
      },
      deleteListing(id) {
        set((s) => ({ vehicles: s.vehicles.filter((v) => v.id !== id) }));
        return quietly(api('DELETE', `/vehicles/${id}`));
      },
      /** Start or replace a discount / special offer on my listing. */
      async setOffer(id, offer) {
        const { vehicle } = await api('POST', `/vehicles/${id}/offer`, offer);
        set((s) => ({ vehicles: upsert(s.vehicles, vehicle) }));
        return vehicle;
      },
      async endOffer(id) {
        const { vehicle } = await api('DELETE', `/vehicles/${id}/offer`);
        set((s) => ({ vehicles: upsert(s.vehicles, vehicle) }));
        return vehicle;
      },
      setListingStatus(id, status) {
        patchVehicle(id, { status });
        return quietly(api('POST', `/vehicles/${id}/status`, { status }).then(({ vehicle }) => set((s) => ({ vehicles: upsert(s.vehicles, vehicle) }))));
      },
      moderateListing(id, action, note = '') {
        const local = { flag: { verification: 'flagged' }, suspend: { status: 'suspended' }, remove: { status: 'removed' }, restore: { status: 'live' }, verify: { verification: 'verified' }, unverify: { verification: 'unverified' }, releaseDuplicate: { status: 'pending_payment', duplicateOf: [] }, unfeature: { featured: false, featuredUntil: null } }[action];
        if (local) patchVehicle(id, local);
        return quietly(api('POST', `/admin/vehicles/${id}/moderate`, { action, note }).then((r) => set((s) => ({ vehicles: upsert(s.vehicles, r.vehicle), audit: [r.audit, ...s.audit] }))));
      },
      addNote(listingId, text) {
        const temp = { id: `n_tmp_${Date.now()}`, listingId, text, at: new Date().toISOString(), author: ref.current.users.find((u) => u.id === meId())?.name || '' };
        set((s) => ({ notes: [temp, ...s.notes] }));
        return quietly(api('POST', `/admin/vehicles/${listingId}/notes`, { text }).then(({ note }) => set((s) => ({ notes: s.notes.map((n) => (n.id === temp.id ? note : n)) }))));
      },
      bumpViews(id) {
        set((s) => ({ vehicles: s.vehicles.map((v) => (v.id === id ? { ...v, views: (v.views || 0) + 1 } : v)) }));
        api('POST', `/vehicles/${id}/view`)
          .then((r) => r?.views != null && patchVehicle(id, { views: r.views }))
          .catch(() => {});
      },
      /** Load one listing that isn't in the bootstrap (e.g. a sold listing opened from a link). */
      async fetchVehicle(id) {
        const { vehicle, seller } = await api('GET', `/vehicles/${id}`);
        set((s) => ({ vehicles: upsert(s.vehicles, vehicle), users: seller && !s.users.some((u) => u.id === seller.id) ? [...s.users, seller] : s.users }));
        return vehicle;
      },

      // ── Payments
      /** Pay the listing fee. Returns the transaction. */
      async pay({ listingId, planId, method, outcome }) {
        const r = await api('POST', '/payments/checkout', { listingId, planId, method, outcome });
        set((s) => ({ payments: upsert(s.payments, r.payment), vehicles: upsert(s.vehicles, r.vehicle), users: r.user ? upsert(s.users, r.user) : s.users }));
        return r.payment;
      },
      /** Publish a listing (kind 'listing') or feature a live one ('feature') with a pack credit. Returns the transaction. */
      async spendCredit(listingId, kind = 'listing') {
        const r = await api('POST', '/payments/use-credit', { listingId, kind });
        set((s) => ({ payments: upsert(s.payments, r.payment), vehicles: upsert(s.vehicles, r.vehicle), users: r.user ? upsert(s.users, r.user) : s.users }));
        return r.payment;
      },
      resolvePending(txnId, outcome) {
        return quietly(
          api('POST', `/payments/${txnId}/resolve`, { outcome }).then((r) => {
            set((s) => ({ payments: upsert(s.payments, r.payment), vehicles: upsert(s.vehicles, r.vehicle) }));
            return r.payment;
          }),
        );
      },

      // ── Enquiries
      async addEnquiry(data) {
        const { enquiry, accessKey, conversationPath } = await api('POST', '/enquiries', data);
        set((s) => ({ enquiries: upsert(s.enquiries, enquiry) }));
        // Guests come back to the conversation with its key, kept on this device.
        if (!enquiry.buyerId) rememberChatKey(enquiry.id, accessKey, enquiry.vehicleId);
        return { ...enquiry, accessKey, conversationPath };
      },

      // ── Conversations (enquiry chat). `key` is a guest buyer's access key.
      async sendMessage(enquiryId, text, key) {
        const { enquiry } = await api('POST', `/enquiries/${enquiryId}/messages`, { text, ...(key ? { key } : {}) });
        set((s) => ({ enquiries: upsert(s.enquiries, enquiry) }));
        return enquiry;
      },
      async markConversationRead(enquiryId, key) {
        const at = new Date().toISOString();
        const me = meId();
        set((s) => ({
          enquiries: s.enquiries.map((e) => (e.id === enquiryId ? { ...e, readAt: { ...(e.readAt || {}), [e.sellerId === me ? 'seller' : 'buyer']: at } } : e)),
          notifications: s.notifications.map((n) => (n.refId === enquiryId && !n.readAt ? { ...n, readAt: at } : n)),
        }));
        return api('POST', `/enquiries/${enquiryId}/read`, key ? { key } : {}).catch(() => {});
      },
      fetchConversation(enquiryId, key) {
        return api('GET', `/enquiries/${enquiryId}${key ? `?key=${encodeURIComponent(key)}` : ''}`);
      },
      setEnquiryStatus(id, status) {
        set((s) => ({ enquiries: s.enquiries.map((e) => (e.id === id ? { ...e, status } : e)) }));
        return quietly(api('PATCH', `/enquiries/${id}`, { status }));
      },

      // ── Documents
      /** Upload a verification document. `data` (or an image `preview`) is the file as a data URL. */
      async uploadDocument({ type, label, fileName, size, preview, data, maskedNumber }) {
        const r = await api('POST', '/documents', { type, label, fileName, size, maskedNumber: maskedNumber || null, data: data || preview || undefined });
        set((s) => ({
          documents: [r.document, ...s.documents.filter((x) => !(x.userId === r.document.userId && x.type === r.document.type))],
          users: s.users.map((u) => (u.id === r.document.userId ? { ...u, docStatus: r.docStatus } : u)),
        }));
        return r.document;
      },
      removeDocument(id) {
        set((s) => ({ documents: s.documents.filter((x) => x.id !== id) }));
        return quietly(api('DELETE', `/documents/${id}`).then((r) => set((s) => ({ users: s.users.map((u) => (u.id === r.userId ? { ...u, docStatus: r.docStatus } : u)) }))));
      },
      reviewDocument(id, status, note = '') {
        set((s) => ({ documents: s.documents.map((d) => (d.id === id ? { ...d, status, reviewNote: note } : d)) }));
        return quietly(
          api('POST', `/documents/${id}/review`, { status, note }).then((r) =>
            set((s) => ({
              documents: upsert(s.documents, r.document),
              users: s.users.map((u) => (u.id === r.document.userId ? { ...u, docStatus: r.docStatus } : u)),
              audit: r.audit ? [r.audit, ...s.audit] : s.audit,
            })),
          ),
        );
      },

      // ── Buyer tools
      toggleSaved(id) {
        set((s) => ({ saved: s.saved.includes(id) ? s.saved.filter((x) => x !== id) : [id, ...s.saved] }));
        if (ref.current.session) quietly(api('POST', `/me/saved/${id}/toggle`).then((r) => set(() => ({ saved: r.saved }))));
      },
      toggleCompare(id) {
        const s = ref.current;
        if (s.compare.includes(id)) {
          set((st) => ({ compare: st.compare.filter((x) => x !== id) }));
          return 'removed';
        }
        // Compare works within one vehicle type (cars, motorcycles or lorries).
        const cat = (vid) => s.vehicles.find((x) => x.id === vid)?.category || 'car';
        if (s.compare.some((x) => cat(x) !== cat(id))) return 'mixed';
        if (s.compare.length >= 3) return 'full';
        set((st) => ({ compare: [...st.compare, id] }));
        return 'added';
      },
      clearCompare() {
        set(() => ({ compare: [] }));
      },
      pushRecent(id) {
        set((s) => (s.recent[0] === id ? {} : { recent: [id, ...s.recent.filter((x) => x !== id)].slice(0, 12) }));
      },
      addSavedSearch(label, query) {
        set((s) => ({ savedSearches: [{ id: `ss_${Date.now().toString(36)}`, label, query, createdAt: new Date().toISOString() }, ...s.savedSearches] }));
        if (!ref.current.session) return Promise.resolve();
        return quietly(api('POST', '/me/saved-searches', { label, query }).then((r) => set(() => ({ savedSearches: r.savedSearches }))));
      },
      removeSavedSearch(id) {
        set((s) => ({ savedSearches: s.savedSearches.filter((x) => x.id !== id) }));
        return ref.current.session ? quietly(api('DELETE', `/me/saved-searches/${id}`)) : Promise.resolve();
      },
      setBuyerPrefs(p) {
        set((s) => ({ buyerPrefs: { ...s.buyerPrefs, ...p } }));
        return ref.current.session?.role === 'buyer' ? quietly(api('PATCH', '/me/prefs', p)) : Promise.resolve();
      },

      setReferralStatus(id, status, note = '') {
        set((s) => ({ referrals: s.referrals.map((r) => (r.id === id ? { ...r, status, history: [{ status, at: new Date().toISOString(), by: r.lender, note }, ...(r.history || [])] } : r)) }));
        return quietly(
          api('POST', `/referrals/${id}/status`, { status, note }).then((r) =>
            set((s) => ({ referrals: upsert(s.referrals, r.referral), notifications: r.notification ? [r.notification, ...s.notifications] : s.notifications })),
          ),
        );
      },

      /** Calculator "Make an enquiry": notifies the selling dealer and the chosen partner bank. */
      async submitFinanceEnquiry(input) {
        const r = await api('POST', '/finance-enquiries', { ...input, consent: true });
        rememberFinanceKey(r.enquiry.id, r.accessKey);
        set((s) => ({
          enquiries: upsert(s.enquiries, r.enquiry),
          referrals: upsert(s.referrals, r.referral),
          notifications: upsertMany(s.notifications, r.notifications),
        }));
        return r;
      },
      /** Finance enquiry tracker (confirmation page). Uses the link key saved on this device, or `key` from the URL. */
      async fetchFinanceEnquiry(id, key) {
        const k = key || financeKey(id);
        const r = await api('GET', `/finance-enquiries/${encodeURIComponent(id)}${k ? `?key=${encodeURIComponent(k)}` : ''}`);
        if (key) rememberFinanceKey(id, key);
        set((s) => ({
          enquiries: upsert(s.enquiries, r.enquiry),
          referrals: upsert(s.referrals, r.referral),
          notifications: upsertMany(s.notifications, r.notifications),
          vehicles: upsert(s.vehicles, r.vehicle),
          users: r.seller && !s.users.some((u) => u.id === r.seller.id) ? [...s.users, r.seller] : s.users,
        }));
        return r;
      },

      // ── Agent handover
      updateHandoverStep(handoverId, key, patch) {
        set((s) => ({ handovers: s.handovers.map((h) => (h.id === handoverId ? { ...h, steps: h.steps.map((st) => (st.key === key ? { ...st, ...patch, updatedAt: new Date().toISOString() } : st)) } : h)) }));
        return quietly(api('PATCH', `/handovers/${handoverId}/steps/${key}`, patch).then(({ handover }) => set((s) => ({ handovers: upsert(s.handovers, handover) }))));
      },
      setHandoverBuyer(handoverId, buyerName) {
        set((s) => ({ handovers: s.handovers.map((h) => (h.id === handoverId ? { ...h, buyerName } : h)) }));
        return quietly(api('PATCH', `/handovers/${handoverId}`, { buyerName }));
      },
      ensureHandover(vehicleId) {
        const existing = ref.current.handovers.find((h) => h.vehicleId === vehicleId);
        if (existing) return Promise.resolve(existing.id);
        return quietly(
          api('POST', '/handovers/ensure', { vehicleId }).then(({ handover }) => {
            set((s) => ({ handovers: upsert(s.handovers, handover) }));
            return handover.id;
          }),
        );
      },

      // ── Vehicle categories (Admin → Categories). Each change reloads the data so every page follows.
      /** Replace the configuration with what the API returned (admin screens). */
      setConfig(config) {
        set((s) => ({ config: { ...s.config, ...config } }));
      },
      /** Upload (data URL) or reset (null) the photo of a city on the Dealers page. */
      async setCityPhoto(city, imageData) {
        const { config } = await api('POST', `/admin/cities/${encodeURIComponent(city)}/image`, { imageData });
        set((s) => ({ config: { ...s.config, ...config } }));
      },
      async saveCategory(key, data) {
        const r = key ? await api('PATCH', `/admin/categories/${key}`, data) : await api('POST', '/admin/categories', data);
        await refresh();
        return r.category;
      },
      async reorderCategories(keys) {
        await api('POST', '/admin/categories/reorder', { keys });
        await refresh();
      },
      async deleteCategory(key, moveTo) {
        await api('DELETE', `/admin/categories/${key}`, moveTo ? { moveTo } : {});
        await refresh();
      },

      // ── Platform configuration
      updateConfig(patch) {
        set((s) => ({ config: { ...s.config, ...patch } }));
        return quietly(api('PATCH', '/admin/config', patch).then((r) => set((s) => ({ config: r.config, audit: [r.audit, ...s.audit] }))));
      },
      async markNotificationsRead(ids) {
        await api('POST', '/me/notifications/read', ids ? { ids } : {});
        const at = new Date().toISOString();
        set((s) => ({ notifications: s.notifications.map((n) => (!ids || ids.includes(n.id) ? { ...n, readAt: n.readAt || at } : n)) }));
      },
    };
  }, [refresh]);

  const value = useMemo(() => {
    const me = state.session ? state.users.find((u) => u.id === state.session.userId) : null;
    const perms = state.session?.permissions || [];
    const member = state.session?.member || null;
    return {
      /** Admin staff: does my role include this permission? ('*' = Managing Director) */
      can: (perm) => state.session?.role === 'admin' && allows(perms, perm),
      perms,
      /** Dealership team member signed in to the dealer account (null for the owner). */
      member,
      /** Owner, or a team member the owner allowed to do this. */
      memberCan: (perm) => !member || allows(member.permissions, perm),
      state,
      status,
      loadError,
      live,
      activeChat,
      me,
      role: state.session?.role || null,
      user: (id) => state.users.find((u) => u.id === id),
      vehicle: (id) => state.vehicles.find((v) => v.id === id),
      ...actions,
    };
  }, [state, status, loadError, live, actions]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);

/**
 * Live duplicate check against all active listings (asks the API, debounced).
 * Pass null to skip. Returns the matching listings: [{ id, matchedOn, title, city, sellerRole }].
 */
export function useDuplicateCheck(data, excludeId) {
  const { findDuplicates } = useStore();
  const [list, setList] = useState([]);
  const reg = data?.regNumber || '';
  const vin = data?.vin || '';
  useEffect(() => {
    if (!reg && !vin) {
      setList([]);
      return undefined;
    }
    let live = true;
    const t = setTimeout(() => {
      findDuplicates({ regNumber: reg, vin }, excludeId)
        .then((r) => live && setList(r))
        .catch(() => live && setList([]));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [reg, vin, excludeId, findDuplicates]);
  return list;
}

/** Public marketplace only ever shows live listings. */
export const isPublic = (v) => v.status === 'live';
