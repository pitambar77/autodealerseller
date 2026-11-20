// Listing packs (e.g. Dealer Pro Pack): credits the seller already paid for. Mirrors the API's packSummary().
const isActive = (p) => new Date(p.expiresAt) > new Date();
const leftOf = (p, kind) => (kind === 'feature' ? (p.featuredTotal || 0) - (p.featuredUsed || []).length : (p.total || 0) - (p.used || []).length);

/** { listings, featured, expiresAt, total, name } across the user's packs that haven't expired. */
export function packSummary(user) {
  const packs = (user?.listingPacks || []).filter(isActive);
  const withLeft = packs.filter((p) => leftOf(p, 'listing') > 0 || leftOf(p, 'feature') > 0).sort((a, b) => String(a.expiresAt).localeCompare(String(b.expiresAt)));
  return {
    listings: packs.reduce((n, p) => n + Math.max(0, leftOf(p, 'listing')), 0),
    featured: packs.reduce((n, p) => n + Math.max(0, leftOf(p, 'feature')), 0),
    total: packs.reduce((n, p) => n + (p.total || 0), 0),
    expiresAt: withLeft[0]?.expiresAt || null,
    name: withLeft[0]?.name || 'pack',
  };
}
