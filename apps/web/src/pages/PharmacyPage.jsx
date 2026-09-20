import { InventoryWorkspace } from '../components/inventory/InventoryWorkspace.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';

export default function PharmacyPage() {
  return (
    <>
      <PageHeader
        eyebrow="Dispensing"
        title="Pharmacy"
        description="Review available medicine stock and record prescription dispensing without directly overwriting quantities."
      />
      <InventoryWorkspace pharmacy />
    </>
  );
}
