'use client';
import { DashArea, SELLERS } from '@/app/Area';

const ROLES = [...SELLERS, 'buyer', 'admin'];

export default function Layout({ children }) {
  return <DashArea roles={ROLES}>{children}</DashArea>;
}
