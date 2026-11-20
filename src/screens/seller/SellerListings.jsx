import { PageHeader } from '../../components/ui';
import { ListingsManager } from '../../components/listings/ListingsManager';

export default function SellerListings() {
  return (
    <div>
      <PageHeader title="My listings" description="Every vehicle you've listed. Add as many as you like: each one has its own listing fee." />
      <ListingsManager base="/seller" />
    </div>
  );
}
