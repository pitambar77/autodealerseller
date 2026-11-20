'use client';
import { DashArea } from '@/app/Area';

const ROLES = ['buyer'];

export default function Layout({ children }) {
  return <DashArea roles={ROLES}>{children}</DashArea>;
}
