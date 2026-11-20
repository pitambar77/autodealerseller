import { useParams } from '@/lib/router';
import { useStore } from '../../store/AppStore';
import { Button, EmptyState, PageHeader } from '../../components/ui';
import VehicleFormWizard from '../../components/vehicle/VehicleFormWizard';
import { vehicleTitle } from '../../components/vehicle/VehicleCard';

export default function SellerVehicleForm() {
  const { id } = useParams();
  const { me, vehicle } = useStore();
  const v = id ? vehicle(id) : null;
  if (id && (!v || v.sellerId !== me.id)) {
    return <EmptyState title="Listing not found" action={<Button to="/seller/listings">Back to my listings</Button>} />;
  }
  return (
    <div>
      <PageHeader
        eyebrow={v ? `Editing ${v.id.toUpperCase()}` : 'Private seller'}
        title={v ? vehicleTitle(v) : 'List a vehicle'}
        description={
          v
            ? 'Changes to a live listing appear right away. Changing the registration number or VIN re-runs the duplicate check.'
            : "Start with the vehicle's registration number, VIN and engine number. You pay the listing fee at the end. You can list as many vehicles as you like."
        }
      />
      <VehicleFormWizard key={id || 'new'} mode="seller" listingId={id} onCancelTo="/seller/listings" />
    </div>
  );
}
