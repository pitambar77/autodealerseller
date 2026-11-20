'use client';
import CategoryRoute from '@/app/CategoryRoute';
import Browse from '@/screens/public/Browse';

export default function Page() {
  return (
    <CategoryRoute>
      <Browse />
    </CategoryRoute>
  );
}
