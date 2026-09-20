import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlaskConical, Plus, TestTube2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { labOrderCreateSchema, labOrderUpdateSchema, LAB_STATUSES } from '@clinicos/contracts';
import { ApiErrorNotice } from '../components/feedback/ApiErrorNotice.jsx';
import { EmptyState } from '../components/feedback/EmptyState.jsx';
import { FormField, inputClassName, textareaClassName } from '../components/forms/FormField.jsx';
import { PatientPicker } from '../components/patients/PatientPicker.jsx';
import { PageHeader } from '../components/ui/PageHeader.jsx';
import { StatusBadge } from '../components/ui/StatusBadge.jsx';
import { createLabOrder, listLabOrders, updateLabOrder } from '../services/clinic.service.js';

export default function LabPage() {
  const queryClient = useQueryClient();
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const labQuery = useQuery({ queryKey: ['lab'], queryFn: () => listLabOrders() });
  const orderForm = useForm({
    resolver: zodResolver(labOrderCreateSchema),
    defaultValues: { patientId: '', testName: '', priority: 'ROUTINE', notes: '' },
  });
  const resultForm = useForm({
    resolver: zodResolver(labOrderUpdateSchema),
    defaultValues: { status: LAB_STATUSES.PROCESSING, result: '' },
  });
  useEffect(() => {
    orderForm.setValue('patientId', selectedPatient?.id || '', {
      shouldValidate: Boolean(selectedPatient),
    });
  }, [orderForm, selectedPatient]);
  const createMutation = useMutation({
    mutationFn: createLabOrder,
    onSuccess: () => {
      orderForm.reset({
        patientId: selectedPatient?.id || '',
        testName: '',
        priority: 'ROUTINE',
        notes: '',
      });
      queryClient.invalidateQueries({ queryKey: ['lab'] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }) => updateLabOrder(id, input),
    onSuccess: () => {
      setSelectedOrder(null);
      queryClient.invalidateQueries({ queryKey: ['lab'] });
    },
  });
  const orders = labQuery.data || [];

  return (
    <>
      <PageHeader
        eyebrow="Diagnostics"
        title="Laboratory"
        description="Track investigation orders from collection through result verification, with clear status and patient context."
      />
      <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-2xl border border-clinic-border bg-clinic-surface p-5 shadow-card">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-clinic-primary-soft text-clinic-primary">
              <Plus aria-hidden="true" size={21} />
            </span>
            <div>
              <h2 className="font-display text-lg font-semibold text-clinic-text">
                Order investigation
              </h2>
              <p className="text-sm text-clinic-muted">Add a patient to the lab queue.</p>
            </div>
          </div>
          <div className="mt-5">
            <PatientPicker selectedPatient={selectedPatient} onSelect={setSelectedPatient} />
          </div>
          <form
            className="mt-5 space-y-4"
            onSubmit={orderForm.handleSubmit((values) => createMutation.mutate(values))}
          >
            <input type="hidden" {...orderForm.register('patientId')} />
            {orderForm.formState.errors.patientId ? (
              <p className="text-sm font-medium text-clinic-danger">Select a patient.</p>
            ) : null}
            <FormField
              id="testName"
              label="Test or panel"
              required
              error={orderForm.formState.errors.testName?.message}
            >
              <input
                id="testName"
                className={inputClassName}
                placeholder="e.g. Complete blood count"
                {...orderForm.register('testName')}
              />
            </FormField>
            <FormField id="labPriority" label="Priority">
              <select
                id="labPriority"
                className={inputClassName}
                {...orderForm.register('priority')}
              >
                <option value="ROUTINE">Routine</option>
                <option value="URGENT">Urgent</option>
              </select>
            </FormField>
            <FormField id="labNotes" label="Clinical note">
              <textarea
                id="labNotes"
                className={textareaClassName}
                {...orderForm.register('notes')}
              />
            </FormField>
            {createMutation.isError ? <ApiErrorNotice error={createMutation.error} /> : null}
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="min-h-12 w-full rounded-xl bg-clinic-action px-4 font-bold text-white hover:bg-clinic-action-hover disabled:opacity-50"
            >
              {createMutation.isPending ? 'Ordering…' : 'Create lab order'}
            </button>
          </form>
        </section>
        <div className="space-y-5">
          <section className="overflow-hidden rounded-2xl border border-clinic-border bg-clinic-surface shadow-card">
            <div className="border-b border-clinic-border px-5 py-4 sm:px-6">
              <h2 className="font-display text-lg font-semibold text-clinic-text">Lab queue</h2>
              <p className="mt-1 text-sm text-clinic-muted">
                {orders.length} investigation{orders.length === 1 ? '' : 's'}
              </p>
            </div>
            {labQuery.isError ? (
              <div className="p-5">
                <ApiErrorNotice error={labQuery.error} />
              </div>
            ) : null}
            {labQuery.isLoading ? (
              <p className="p-10 text-center text-sm text-clinic-muted">Loading lab orders…</p>
            ) : null}
            {!labQuery.isLoading && !orders.length ? (
              <EmptyState
                icon={FlaskConical}
                title="No lab orders"
                description="New investigations will appear here for collection and processing."
              />
            ) : null}
            {orders.length ? (
              <ul className="divide-y divide-clinic-border">
                {orders.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-clinic-text">{order.testName}</p>
                        {order.priority === 'URGENT' ? (
                          <span className="rounded-full bg-clinic-danger-soft px-2 py-1 text-xs font-bold text-clinic-danger">
                            Urgent
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-clinic-muted">
                        {order.orderNumber} · {order.patientId?.fullName} (
                        {order.patientId?.patientNumber})
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={order.status} />
                      {!['VERIFIED', 'CANCELLED'].includes(order.status) ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrder(order);
                            resultForm.reset({ status: order.status, result: order.result || '' });
                          }}
                          className="min-h-11 rounded-xl border border-clinic-primary px-3 text-sm font-bold text-clinic-primary hover:bg-clinic-primary-soft"
                        >
                          Update
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
          {selectedOrder ? (
            <section className="rounded-2xl border border-clinic-primary/30 bg-clinic-surface p-5 shadow-card">
              <div className="flex items-start justify-between">
                <div className="flex gap-3">
                  <TestTube2 aria-hidden="true" className="mt-0.5 text-clinic-primary" size={22} />
                  <div>
                    <h2 className="font-display text-lg font-semibold text-clinic-text">
                      Update {selectedOrder.orderNumber}
                    </h2>
                    <p className="mt-1 text-sm text-clinic-muted">
                      {selectedOrder.testName} for {selectedOrder.patientId?.fullName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close result form"
                  onClick={() => setSelectedOrder(null)}
                  className="flex size-11 items-center justify-center rounded-lg text-clinic-muted hover:bg-clinic-subtle"
                >
                  <X aria-hidden="true" size={20} />
                </button>
              </div>
              <form
                className="mt-5 space-y-4"
                onSubmit={resultForm.handleSubmit((input) =>
                  updateMutation.mutate({ id: selectedOrder.id, input }),
                )}
              >
                <FormField id="labStatus" label="Status" required>
                  <select
                    id="labStatus"
                    className={inputClassName}
                    {...resultForm.register('status')}
                  >
                    {Object.values(LAB_STATUSES).map((status) => (
                      <option key={status} value={status}>
                        {status.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField
                  id="labResult"
                  label="Result"
                  error={resultForm.formState.errors.result?.message}
                  helper="A result is required before verification."
                >
                  <textarea
                    id="labResult"
                    className={`${textareaClassName} min-h-40`}
                    {...resultForm.register('result')}
                  />
                </FormField>
                {updateMutation.isError ? <ApiErrorNotice error={updateMutation.error} /> : null}
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="min-h-12 w-full rounded-xl bg-clinic-action px-4 font-bold text-white hover:bg-clinic-action-hover disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save lab update'}
                </button>
              </form>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
