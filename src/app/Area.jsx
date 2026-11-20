'use client';
// Layout helpers: put a page inside one of the app's layouts (and the role guard for dashboards).
import { OutletProvider } from '../lib/router';
import PublicLayout from '../layouts/PublicLayout';
import AuthLayout from '../layouts/AuthLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import ProtectedRoute from '../routes/ProtectedRoute';

export const SELLERS = ['seller', 'agent', 'dealer'];

export function PublicArea({ children }) {
  return (
    <OutletProvider value={children}>
      <PublicLayout />
    </OutletProvider>
  );
}

export function AuthArea({ children }) {
  return (
    <OutletProvider value={children}>
      <AuthLayout />
    </OutletProvider>
  );
}

/** Dashboard pages: role guard → dashboard layout → page. */
export function DashArea({ roles, children }) {
  return (
    <OutletProvider
      value={
        <OutletProvider value={children}>
          <DashboardLayout />
        </OutletProvider>
      }
    >
      <ProtectedRoute roles={roles} />
    </OutletProvider>
  );
}
