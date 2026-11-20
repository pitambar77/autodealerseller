'use client';
import CategoryRoute from '@/app/CategoryRoute';
import VehicleDetails from '@/screens/public/VehicleDetails';

export default function Page() {
  return (
    <CategoryRoute>
      <VehicleDetails />
    </CategoryRoute>
  );
}
