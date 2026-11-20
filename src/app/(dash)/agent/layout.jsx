'use client';
import { DashArea } from '@/app/Area';

const ROLES = ['agent'];

export default function Layout({ children }) {
  return <DashArea roles={ROLES}>{children}</DashArea>;
}
