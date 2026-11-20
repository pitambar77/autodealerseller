'use client';
// Pages under a category's web address (/cars, /buses, /trucks-trailers…). Category addresses are set
// in Admin → Categories, so they're resolved here: old addresses redirect, unknown ones show "not found".
import { Fragment } from 'react';
import { Navigate, useLocation, useParams } from '../lib/router';
import { resolveSlug, typeFor } from '../data/vehicleTypes';
import NotFound from '../screens/public/NotFound';

export default function CategoryRoute({ children }) {
  const { category } = useParams();
  const loc = useLocation();
  const hit = resolveSlug(category);
  if (!hit) return <NotFound />;
  if (hit.alias) {
    const rest = loc.pathname.split('/').slice(2).join('/');
    return <Navigate to={`${typeFor(hit.key).path}${rest ? `/${rest}` : ''}${loc.search}`} replace />;
  }
  // A fresh page per category, so filters don't carry over from another category.
  return <Fragment key={hit.key}>{children}</Fragment>;
}
