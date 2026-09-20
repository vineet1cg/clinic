import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Boxes, PackagePlus, Pill, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { inventoryItemCreateSchema, inventoryTransactionSchema } from '@clinicos/contracts';
import {
  createInventoryItem,
  listInventory,
  recordInventoryTransaction,
} from '../../services/clinic.service.js';
import { ApiErrorNotice } from '../feedback/ApiErrorNotice.jsx';
import { EmptyState } from '../feedback/EmptyState.jsx';
import { FormField, inputClassName } from '../forms/FormField.jsx';

function stockTone(item) {
  if (item.quantityOnHand <= item.reorderLevel) return 'bg-clinic-danger-soft text-clinic-danger';
  return 'bg-clinic-accent-soft text-clinic-accent';
}

export function InventoryWorkspace({ pharmacy = false }) {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState(null);
  const inventoryQuery = useQuery({ queryKey: ['inventory'], queryFn: listInventory });
  const itemForm = useForm({
    resolver: zodResolver(inventoryItemCreateSchema),
    defaultValues: {
      name: '',
      genericName: '',
      sku: '',
      batchNumber: '',
      expiryDate: '',
      reorderLevel: 10,
      unit: 'tablet',
    },
  });
  const transactionForm = useForm({
    resolver: zodResolver(inventoryTransactionSchema),
    defaultValues: {
      type: pharmacy ? 'DISPENSE' : 'PURCHASE',
      quantity: 1,
      reason: pharmacy ? 'Prescription dispensing' : 'Stock received',
    },
  });
  const itemMutation = useMutation({
    mutationFn: createInventoryItem,
    onSuccess: () => {
      itemForm.reset();
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
  const transactionMutation = useMutation({
    mutationFn: ({ id, input }) => recordInventoryTransaction(id, input),
    onSuccess: () => {
      setSelectedItem(null);
      transactionForm.reset({
        type: pharmacy ? 'DISPENSE' : 'PURCHASE',
        quantity: 1,
        reason: pharmacy ? 'Prescription dispensing' : 'Stock received',
      });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
  const inventory = inventoryQuery.data || [];

  return (
    <div
      className={`grid gap-5 ${pharmacy ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'xl:grid-cols-[380px_minmax(0,1fr)]'}`}
    >
      {!pharmacy ? (
        <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card">
          <div className="flex items-center gap-3">
            <PackagePlus aria-hidden="true" className="text-clinic-primary" size={22} />
            <div>
              <h2 className="font-display text-lg font-semibold text-clinic-text">Add medicine</h2>
              <p className="text-sm text-clinic-muted">Create a batch-tracked stock item.</p>
            </div>
          </div>
          <form
            className="mt-5 space-y-4"
            onSubmit={itemForm.handleSubmit((values) => itemMutation.mutate(values))}
          >
            <FormField
              id="inventoryName"
              label="Medicine name"
              required
              error={itemForm.formState.errors.name?.message}
            >
              <input id="inventoryName" className={inputClassName} {...itemForm.register('name')} />
            </FormField>
            <FormField id="genericName" label="Generic name">
              <input
                id="genericName"
                className={inputClassName}
                {...itemForm.register('genericName')}
              />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                id="sku"
                label="SKU"
                required
                error={itemForm.formState.errors.sku?.message}
              >
                <input id="sku" className={inputClassName} {...itemForm.register('sku')} />
              </FormField>
              <FormField id="batchNumber" label="Batch">
                <input
                  id="batchNumber"
                  className={inputClassName}
                  {...itemForm.register('batchNumber')}
                />
              </FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField id="expiryDate" label="Expiry">
                <input
                  id="expiryDate"
                  type="date"
                  className={inputClassName}
                  {...itemForm.register('expiryDate')}
                />
              </FormField>
              <FormField id="inventoryUnit" label="Unit">
                <input
                  id="inventoryUnit"
                  className={inputClassName}
                  {...itemForm.register('unit')}
                />
              </FormField>
            </div>
            <FormField id="reorderLevel" label="Low-stock level">
              <input
                id="reorderLevel"
                type="number"
                min="0"
                className={inputClassName}
                {...itemForm.register('reorderLevel', { valueAsNumber: true })}
              />
            </FormField>
            {itemMutation.isError ? <ApiErrorNotice error={itemMutation.error} /> : null}
            <button
              type="submit"
              disabled={itemMutation.isPending}
              className="min-h-12 w-full rounded-xl bg-clinic-action px-4 font-bold text-white hover:bg-clinic-action-hover disabled:opacity-50"
            >
              {itemMutation.isPending ? 'Adding…' : 'Add inventory item'}
            </button>
          </form>
        </section>
      ) : null}

      <section
        className={`overflow-hidden rounded-2xl border border-clinic-border bg-clinic-surface shadow-card ${pharmacy ? '' : ''}`}
      >
        <div className="border-b border-clinic-border px-5 py-4 sm:px-6">
          <h2 className="font-display text-lg font-semibold text-clinic-text">
            {pharmacy ? 'Medicine stock' : 'Current inventory'}
          </h2>
          <p className="mt-1 text-sm text-clinic-muted">
            {inventory.length} tracked item{inventory.length === 1 ? '' : 's'}
          </p>
        </div>
        {inventoryQuery.isError ? (
          <div className="p-5">
            <ApiErrorNotice error={inventoryQuery.error} />
          </div>
        ) : null}
        {inventoryQuery.isLoading ? (
          <p className="p-10 text-center text-sm text-clinic-muted">Loading inventory…</p>
        ) : null}
        {!inventoryQuery.isLoading && !inventory.length ? (
          <EmptyState
            icon={Boxes}
            title="No medicines tracked"
            description="Add the first stock item to begin transaction-based inventory tracking."
          />
        ) : null}
        {inventory.length ? (
          <ul className="divide-y divide-clinic-border">
            {inventory.map((item) => {
              const low = item.quantityOnHand <= item.reorderLevel;
              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-clinic-text">{item.name}</p>
                      {low ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-clinic-danger-soft px-2 py-1 text-xs font-bold text-clinic-danger">
                          <AlertTriangle aria-hidden="true" size={13} />
                          Low stock
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-clinic-muted">
                      {item.sku} · Batch {item.batchNumber || 'not set'} · Exp{' '}
                      {item.expiryDate || 'not set'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${stockTone(item)}`}>
                      {item.quantityOnHand} {item.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItem(item);
                        transactionForm.reset({
                          type: pharmacy ? 'DISPENSE' : 'PURCHASE',
                          quantity: 1,
                          reason: pharmacy ? 'Prescription dispensing' : 'Stock received',
                        });
                      }}
                      className="min-h-11 rounded-xl border border-clinic-primary px-3 text-sm font-bold text-clinic-primary hover:bg-clinic-primary-soft"
                    >
                      {pharmacy ? 'Dispense' : 'Adjust'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {selectedItem ? (
        <aside
          className={`${pharmacy ? '' : 'xl:col-start-2'} rounded-2xl border border-clinic-primary/30 bg-clinic-surface p-5 shadow-card`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3">
              <Pill aria-hidden="true" className="mt-0.5 text-clinic-primary" size={22} />
              <div>
                <h2 className="font-display text-lg font-semibold text-clinic-text">
                  {pharmacy ? 'Dispense medicine' : 'Record transaction'}
                </h2>
                <p className="mt-1 text-sm text-clinic-muted">
                  {selectedItem.name} · {selectedItem.quantityOnHand} available
                </p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close transaction form"
              onClick={() => setSelectedItem(null)}
              className="flex size-11 items-center justify-center rounded-lg text-clinic-muted hover:bg-clinic-subtle"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </div>
          <form
            className="mt-5 space-y-4"
            onSubmit={transactionForm.handleSubmit((input) =>
              transactionMutation.mutate({ id: selectedItem.id, input }),
            )}
          >
            {!pharmacy ? (
              <FormField id="transactionType" label="Transaction type" required>
                <select
                  id="transactionType"
                  className={inputClassName}
                  {...transactionForm.register('type')}
                >
                  <option value="PURCHASE">Purchase / received</option>
                  <option value="ADJUSTMENT_IN">Adjustment in</option>
                  <option value="ADJUSTMENT_OUT">Adjustment out</option>
                  <option value="DISPENSE">Dispensed</option>
                </select>
              </FormField>
            ) : (
              <input type="hidden" value="DISPENSE" {...transactionForm.register('type')} />
            )}
            <FormField
              id="transactionQuantity"
              label="Quantity"
              required
              error={transactionForm.formState.errors.quantity?.message}
            >
              <input
                id="transactionQuantity"
                type="number"
                min="1"
                max={pharmacy ? selectedItem.quantityOnHand : undefined}
                className={inputClassName}
                {...transactionForm.register('quantity', { valueAsNumber: true })}
              />
            </FormField>
            <FormField
              id="transactionReason"
              label="Reason"
              required
              error={transactionForm.formState.errors.reason?.message}
            >
              <input
                id="transactionReason"
                className={inputClassName}
                {...transactionForm.register('reason')}
              />
            </FormField>
            {transactionMutation.isError ? (
              <ApiErrorNotice error={transactionMutation.error} />
            ) : null}
            <button
              type="submit"
              disabled={transactionMutation.isPending}
              className="min-h-12 w-full rounded-xl bg-clinic-action px-4 font-bold text-white hover:bg-clinic-action-hover disabled:opacity-50"
            >
              {transactionMutation.isPending
                ? 'Recording…'
                : pharmacy
                  ? 'Confirm dispense'
                  : 'Record transaction'}
            </button>
          </form>
        </aside>
      ) : null}
    </div>
  );
}
