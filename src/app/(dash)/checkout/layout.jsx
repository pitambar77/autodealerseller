'use client';
import { DashArea, SELLERS } from '@/app/Area';

const ROLES = SELLERS;

export default function Layout({ children }) {
  return <DashArea roles={ROLES}>{children}</DashArea>;
}
