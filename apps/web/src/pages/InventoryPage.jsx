import { InventoryWorkspace } from '../components/inventory/InventoryWorkspace.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';

export default function InventoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Pharmacy"
        title="Inventory"
        description="Track medicine quantities through immutable stock transactions, with batch, expiry, and low-stock visibility."
      />
      <InventoryWorkspace />
    </>
  );
}
