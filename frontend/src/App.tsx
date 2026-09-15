import {
  Award,
  Building2,
  FileText,
  FlaskConical,
  Home,
  IndianRupee,
  LayoutDashboard,
  Package,
  QrCode,
  Receipt,
  Route as RouteIcon,
  ScrollText,
  Store,
  Thermometer,
  TrendingUp,
  User,
  Wallet,
  Wifi,
} from 'lucide-react'
import { Navigate, Route, Routes } from 'react-router-dom'

import type { PWATab } from '@/components/layout/PWAShell'
import { PWAShell } from '@/components/layout/PWAShell'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import type { WebNavLink } from '@/components/layout/WebShell'
import { WebShell } from '@/components/layout/WebShell'
import NotBuiltYet from '@/pages/NotBuiltYet'

const FARMER_TABS: PWATab[] = [
  { label: 'Home', path: '/farmer/dashboard', icon: Home },
  { label: 'Batches', path: '/farmer/batches', icon: Package },
  { label: 'Contracts', path: '/farmer/contracts', icon: FileText },
  { label: 'Earnings', path: '/farmer/earnings', icon: Wallet },
  { label: 'Profile', path: '/farmer/profile', icon: User },
]

const CONSUMER_TABS: PWATab[] = [
  { label: 'Browse', path: '/consumer/browse', icon: Store },
  { label: 'Orders', path: '/consumer/orders', icon: Receipt },
  { label: 'Scan QR', path: '/consumer/scan', icon: QrCode },
  { label: 'Profile', path: '/consumer/profile', icon: User },
]

const LOGISTICS_TABS: PWATab[] = [
  { label: 'Dashboard', path: '/logistics/dashboard', icon: LayoutDashboard },
  { label: 'Routes', path: '/logistics/routes', icon: RouteIcon },
  { label: 'Temperature', path: '/logistics/temperature-log', icon: Thermometer },
  { label: 'Profile', path: '/logistics/profile', icon: User },
]

const BUYER_LINKS: WebNavLink[] = [
  { label: 'Dashboard', path: '/buyer/dashboard', icon: LayoutDashboard },
  { label: 'Catalog', path: '/buyer/catalog', icon: Store },
  { label: 'Orders', path: '/buyer/orders', icon: Receipt },
  { label: 'Reliability', path: '/buyer/reliability', icon: Award },
]

const ADMIN_LINKS: WebNavLink[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Demand', path: '/admin/demand', icon: TrendingUp },
  { label: 'Price', path: '/admin/price', icon: IndianRupee },
  { label: 'Routes', path: '/admin/routes', icon: RouteIcon },
  { label: 'Simulator', path: '/admin/simulate', icon: FlaskConical },
  { label: 'FPOs & Batches', path: '/admin/fpos', icon: Building2 },
  { label: 'Escrow', path: '/admin/escrow', icon: Wallet },
  { label: 'DPI Status', path: '/admin/dpi', icon: Wifi },
  { label: 'Audit Log', path: '/admin/audit', icon: ScrollText },
]

function App() {
  return (
    <Routes>
      {/* Public / auth */}
      <Route path="/" element={<NotBuiltYet screen="Landing / Role Selector (01)" />} />
      <Route path="/register" element={<NotBuiltYet screen="Register (02)" />} />
      <Route path="/login" element={<NotBuiltYet screen="Login (03)" />} />
      <Route path="/verify-otp" element={<NotBuiltYet screen="OTP Verification (04)" />} />
      <Route path="/forgot-password" element={<NotBuiltYet screen="Forgot Password (05)" />} />
      <Route path="/reset-password" element={<NotBuiltYet screen="Reset Password (06)" />} />
      <Route path="/scan/:qrHash" element={<NotBuiltYet screen="QR Scan Result / BIR View (22)" />} />

      {/* Farmer PWA */}
      <Route element={<ProtectedRoute role="FARMER" />}>
        <Route element={<PWAShell title="BharatPure" tabs={FARMER_TABS} />}>
          <Route path="/farmer/dashboard" element={<NotBuiltYet screen="Farmer Dashboard (07)" />} />
          <Route path="/farmer/batches" element={<NotBuiltYet screen="Batch List (08)" />} />
          <Route path="/farmer/batches/new/step-1" element={<NotBuiltYet screen="Batch Create Step 1 (09)" />} />
          <Route path="/farmer/batches/new/step-2" element={<NotBuiltYet screen="Batch Create Step 2 (10)" />} />
          <Route path="/farmer/batches/new/step-3" element={<NotBuiltYet screen="Batch Create Step 3 (11)" />} />
          <Route path="/farmer/batches/:batchId" element={<NotBuiltYet screen="Batch Detail (12)" />} />
          <Route path="/farmer/batches/:batchId/test-result" element={<NotBuiltYet screen="Quality Test Result (13)" />} />
          <Route
            path="/farmer/batches/:batchId/upload-certificate"
            element={<NotBuiltYet screen="Certificate Upload (14)" />}
          />
          <Route path="/farmer/earnings" element={<NotBuiltYet screen="Earnings Dashboard (15)" />} />
          <Route path="/farmer/contracts" element={<NotBuiltYet screen="Procurement Contracts List (16)" />} />
          <Route path="/farmer/contracts/:contractId" element={<NotBuiltYet screen="Contract Detail (17)" />} />
          <Route path="/farmer/trust-score" element={<NotBuiltYet screen="FPO Trust Score (18)" />} />
          <Route path="/farmer/profile" element={<NotBuiltYet screen="Profile" />} />
        </Route>
      </Route>

      {/* Consumer PWA */}
      <Route element={<ProtectedRoute role="CONSUMER" />}>
        <Route element={<PWAShell title="BharatPure" tabs={CONSUMER_TABS} />}>
          <Route path="/consumer/browse" element={<NotBuiltYet screen="Consumer Browse / Dashboard (19)" />} />
          <Route path="/consumer/listings/:listingId" element={<NotBuiltYet screen="Product Detail (20)" />} />
          <Route path="/consumer/scan" element={<NotBuiltYet screen="QR Scanner (21)" />} />
          <Route path="/consumer/cart" element={<NotBuiltYet screen="Cart (23)" />} />
          <Route
            path="/consumer/orders/:orderId/confirmation"
            element={<NotBuiltYet screen="Order Confirmation (24)" />}
          />
          <Route path="/consumer/orders/:orderId/track" element={<NotBuiltYet screen="Order Tracking (25)" />} />
          <Route path="/consumer/orders" element={<NotBuiltYet screen="Order History (26)" />} />
          <Route path="/consumer/subscriptions" element={<NotBuiltYet screen="Subscription Overview (27)" />} />
          <Route path="/consumer/profile" element={<NotBuiltYet screen="Profile" />} />
        </Route>
      </Route>

      {/* Bulk Buyer web */}
      <Route element={<ProtectedRoute role="BULK_BUYER" />}>
        <Route element={<WebShell links={BUYER_LINKS} />}>
          <Route path="/buyer/dashboard" element={<NotBuiltYet screen="Bulk Buyer Dashboard (28)" />} />
          <Route path="/buyer/catalog" element={<NotBuiltYet screen="Verified Batch Catalog (29)" />} />
          <Route path="/buyer/listings/:listingId" element={<NotBuiltYet screen="Batch Detail — Bulk Buyer (30)" />} />
          <Route path="/buyer/orders/new" element={<NotBuiltYet screen="Bulk Order Form (31)" />} />
          <Route path="/buyer/orders" element={<NotBuiltYet screen="Order History — Bulk Buyer (32)" />} />
          <Route path="/buyer/reliability" element={<NotBuiltYet screen="Buyer Reliability Score (47)" />} />
        </Route>
      </Route>

      {/* Logistics PWA */}
      <Route element={<ProtectedRoute role="LOGISTICS" />}>
        <Route element={<PWAShell title="BharatPure" tabs={LOGISTICS_TABS} />}>
          <Route path="/logistics/dashboard" element={<NotBuiltYet screen="Driver Dashboard (33)" />} />
          <Route path="/logistics/routes/:routeId" element={<NotBuiltYet screen="Route Map View (34)" />} />
          <Route
            path="/logistics/routes/:routeId/stops/:stopId"
            element={<NotBuiltYet screen="Stop Detail / Pickup Confirmation (35)" />}
          />
          <Route path="/logistics/temperature-log" element={<NotBuiltYet screen="Temperature Log Entry (36)" />} />
          <Route path="/logistics/deliver/:orderId" element={<NotBuiltYet screen="Delivery Confirmation (37)" />} />
          <Route path="/logistics/profile" element={<NotBuiltYet screen="Profile" />} />
        </Route>
      </Route>

      {/* Admin web */}
      <Route element={<ProtectedRoute role="ADMIN" />}>
        <Route element={<WebShell links={ADMIN_LINKS} />}>
          <Route path="/admin/dashboard" element={<NotBuiltYet screen="Admin Dashboard (38)" />} />
          <Route path="/admin/demand" element={<NotBuiltYet screen="Demand Intelligence Dashboard (39)" />} />
          <Route path="/admin/price" element={<NotBuiltYet screen="Price Intelligence Dashboard (40)" />} />
          <Route path="/admin/routes" element={<NotBuiltYet screen="Route Optimization Control Panel (41)" />} />
          <Route path="/admin/simulate" element={<NotBuiltYet screen="What-if Simulator (42)" />} />
          <Route path="/admin/fpos" element={<NotBuiltYet screen="FPO & Batch Management (43)" />} />
          <Route path="/admin/escrow" element={<NotBuiltYet screen="Escrow Management (44)" />} />
          <Route path="/admin/dpi" element={<NotBuiltYet screen="DPI Integration Status (45)" />} />
          <Route path="/admin/audit" element={<NotBuiltYet screen="Audit Log Viewer (46)" />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
