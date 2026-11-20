import { PageHeader } from '../../components/ui';
import { EnquiryInbox } from '../../components/listings/EnquiryInbox';

export default function SellerEnquiries() {
  return (
    <div>
      <PageHeader title="Enquiries" description="Messages from buyers about your vehicles. Reply here, call or WhatsApp them." />
      <EnquiryInbox />
    </div>
  );
}
