'use client';
import { DashArea } from '@/app/Area';

const ROLES = ['dealer'];

export default function Layout({ children }) {
  return <DashArea roles={ROLES}>{children}</DashArea>;
}
