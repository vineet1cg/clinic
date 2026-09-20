import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PERMISSIONS } from '@clinicos/contracts';
import { LoadingScreen } from '../components/feedback/LoadingScreen.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { ProtectedRoute } from '../components/layout/ProtectedRoute.jsx';
import { PermissionBoundary } from '../components/layout/PermissionBoundary.jsx';

const LoginPage = lazy(() => import('../pages/LoginPage.jsx'));
const DashboardPage = lazy(() => import('../pages/DashboardPage.jsx'));
const PatientsPage = lazy(() => import('../pages/PatientsPage.jsx'));
const QueuePage = lazy(() => import('../pages/QueuePage.jsx'));
const QueueDisplayPage = lazy(() => import('../pages/QueueDisplayPage.jsx'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage.jsx'));
const PatientRegistrationPage = lazy(() => import('../pages/PatientRegistrationPage.jsx'));
const PatientSummaryPage = lazy(() => import('../pages/PatientSummaryPage.jsx'));
const AppointmentsPage = lazy(() => import('../pages/AppointmentsPage.jsx'));
const CalendarPage = lazy(() => import('../pages/CalendarPage.jsx'));
const ConsultationPage = lazy(() => import('../pages/ConsultationPage.jsx'));
const BillingPage = lazy(() => import('../pages/BillingPage.jsx'));
const InvoicePage = lazy(() => import('../pages/InvoicePage.jsx'));
const PharmacyPage = lazy(() => import('../pages/PharmacyPage.jsx'));
const InventoryPage = lazy(() => import('../pages/InventoryPage.jsx'));
const LabPage = lazy(() => import('../pages/LabPage.jsx'));
const ReportsPage = lazy(() => import('../pages/ReportsPage.jsx'));
const StaffPage = lazy(() => import('../pages/StaffPage.jsx'));
const RolesPage = lazy(() => import('../pages/RolesPage.jsx'));
const SettingsPage = lazy(() => import('../pages/SettingsPage.jsx'));
const ChangePasswordPage = lazy(() => import('../pages/ChangePasswordPage.jsx'));

function lazyElement(Component, permissions) {
  const page = (
    <Suspense fallback={<LoadingScreen />}>
      <Component />
    </Suspense>
  );
  return permissions ? (
    <PermissionBoundary permissions={permissions}>{page}</PermissionBoundary>
  ) : (
    page
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/app/dashboard" replace /> },
  { path: '/login', element: lazyElement(LoginPage) },
  {
    path: '/change-password',
    element: <ProtectedRoute allowPasswordReset>{lazyElement(ChangePasswordPage)}</ProtectedRoute>,
  },
  { path: '/display/:doctorId', element: lazyElement(QueueDisplayPage) },
  {
    path: '/app',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="dashboard" replace /> },
      { path: 'dashboard', element: lazyElement(DashboardPage) },
      { path: 'patients', element: lazyElement(PatientsPage, [PERMISSIONS.PATIENT_VIEW]) },
      {
        path: 'patients/new',
        element: lazyElement(PatientRegistrationPage, [PERMISSIONS.PATIENT_CREATE]),
      },
      {
        path: 'patients/:id',
        element: lazyElement(PatientSummaryPage, [PERMISSIONS.PATIENT_VIEW]),
      },
      {
        path: 'appointments',
        element: lazyElement(AppointmentsPage, [PERMISSIONS.APPOINTMENT_VIEW]),
      },
      { path: 'calendar', element: lazyElement(CalendarPage, [PERMISSIONS.APPOINTMENT_VIEW]) },
      { path: 'queue', element: lazyElement(QueuePage, [PERMISSIONS.QUEUE_VIEW]) },
      {
        path: 'consultation/:queueId',
        element: lazyElement(ConsultationPage, [PERMISSIONS.ENCOUNTER_VIEW]),
      },
      { path: 'billing', element: lazyElement(BillingPage, [PERMISSIONS.BILLING_VIEW]) },
      { path: 'billing/:invoiceId', element: lazyElement(InvoicePage, [PERMISSIONS.BILLING_VIEW]) },
      { path: 'pharmacy', element: lazyElement(PharmacyPage, [PERMISSIONS.INVENTORY_VIEW]) },
      { path: 'inventory', element: lazyElement(InventoryPage, [PERMISSIONS.INVENTORY_VIEW]) },
      { path: 'lab', element: lazyElement(LabPage, [PERMISSIONS.LAB_VIEW]) },
      {
        path: 'reports',
        element: lazyElement(ReportsPage, [
          PERMISSIONS.REPORT_OPERATIONAL,
          PERMISSIONS.REPORT_FINANCIAL,
        ]),
      },
      { path: 'staff', element: lazyElement(StaffPage, [PERMISSIONS.STAFF_VIEW]) },
      { path: 'roles', element: lazyElement(RolesPage, [PERMISSIONS.STAFF_VIEW]) },
      { path: 'settings', element: lazyElement(SettingsPage, [PERMISSIONS.SETTINGS_VIEW]) },
    ],
  },
  { path: '*', element: lazyElement(NotFoundPage) },
]);
