'use client';
import { Navigate } from '@/lib/router';

// Old address from when private sellers had one listing.
export default function Page() {
  return <Navigate to="/seller/listings" replace />;
}
