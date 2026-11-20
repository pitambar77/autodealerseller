'use client';
import { DashArea } from '@/app/Area';

const ROLES = ['admin'];

export default function Layout({ children }) {
  return <DashArea roles={ROLES}>{children}</DashArea>;
}
