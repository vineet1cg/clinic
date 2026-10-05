import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  PackageSearch,
  Pill,
  Settings,
  Users,
  UserRoundCog,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { PERMISSIONS } from '@clinicos/contracts';
import { ClinicBrand } from '../ui/ClinicBrand.jsx';

const navigation = [
  { label: 'Dashboard', to: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Patients', to: '/app/patients', icon: Users, permission: PERMISSIONS.PATIENT_VIEW },
  {
    label: 'Appointments',
    to: '/app/appointments',
    icon: CalendarDays,
    permission: PERMISSIONS.APPOINTMENT_VIEW,
  },
  { label: 'Queue', to: '/app/queue', icon: ClipboardList, permission: PERMISSIONS.QUEUE_VIEW },
  { label: 'Billing', to: '/app/billing', icon: CreditCard, permission: PERMISSIONS.BILLING_VIEW },
  { label: 'Pharmacy', to: '/app/pharmacy', icon: Pill, permission: PERMISSIONS.INVENTORY_VIEW },
  {
    label: 'Inventory',
    to: '/app/inventory',
    icon: PackageSearch,
    permission: PERMISSIONS.INVENTORY_VIEW,
  },
  { label: 'Laboratory', to: '/app/lab', icon: FlaskConical, permission: PERMISSIONS.LAB_VIEW },
  {
    label: 'Reports',
    to: '/app/reports',
    icon: BarChart3,
    anyPermission: [PERMISSIONS.REPORT_OPERATIONAL, PERMISSIONS.REPORT_FINANCIAL],
  },
  { label: 'Staff', to: '/app/staff', icon: UserRoundCog, permission: PERMISSIONS.STAFF_VIEW },
  { label: 'Settings', to: '/app/settings', icon: Settings, permission: PERMISSIONS.SETTINGS_VIEW },
];

function canAccess(item, permissions) {
  if (!item.permission && !item.anyPermission) return true;
  if (item.permission) return permissions.includes(item.permission);
  return item.anyPermission.some((permission) => permissions.includes(permission));
}

export function Sidebar({ open, onClose, user }) {
  const items = navigation.filter((item) => canAccess(item, user.permissions));

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="no-print fixed inset-0 z-30 bg-slate-950/50"
          onClick={onClose}
        />
      ) : null}
      <aside
        id="primary-navigation"
        aria-label="Primary navigation"
        aria-hidden={!open}
        inert={!open}
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-72 max-w-[calc(100vw-2rem)] flex-col border-r border-clinic-border bg-clinic-surface shadow-2xl transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-20 items-center justify-between border-b border-clinic-border px-5">
          <NavLink
            to="/app/dashboard"
            className="flex min-h-11 items-center gap-3"
            onClick={onClose}
          >
            <ClinicBrand />
          </NavLink>
          <button
            type="button"
            aria-label="Close navigation"
            className="flex size-11 items-center justify-center rounded-xl text-clinic-muted hover:bg-clinic-subtle"
            onClick={onClose}
          >
            <X aria-hidden="true" size={22} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-clinic-muted">
            Workspace
          </p>
          <ul className="space-y-1">
            {items.map(({ label, to, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-clinic-primary-soft text-clinic-primary-dark'
                        : 'text-clinic-muted hover:bg-clinic-subtle hover:text-clinic-text'
                    }`
                  }
                >
                  <Icon aria-hidden="true" size={20} strokeWidth={2} />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-clinic-border p-4">
          <div className="rounded-xl bg-clinic-bg p-3">
            <p className="text-xs font-semibold text-clinic-text">Your workspace</p>
            <p className="mt-1 text-xs leading-5 text-clinic-muted">
              Access follows your individual staff role.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
