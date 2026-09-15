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
import ForgotPassword from '@/pages/auth/ForgotPassword'
import Landing from '@/pages/auth/Landing'
import Login from '@/pages/auth/Login'
import OtpVerification from '@/pages/auth/OtpVerification'
import Register from '@/pages/auth/Register'
import ResetPassword from '@/pages/auth/ResetPassword'
import Browse from '@/pages/consumer/Browse'
import Cart from '@/pages/consumer/Cart'
import OrderConfirmation from '@/pages/consumer/OrderConfirmation'
import OrderHistory from '@/pages/consumer/OrderHistory'
import OrderTracking from '@/pages/consumer/OrderTracking'
import ProductDetail from '@/pages/consumer/ProductDetail'
import QrScanner from '@/pages/consumer/QrScanner'
import QrScanResult from '@/pages/consumer/QrScanResult'
import SubscriptionOverview from '@/pages/consumer/SubscriptionOverview'
import BatchDetailBuyer from '@/pages/buyer/BatchDetailBuyer'
import BulkOrderForm from '@/pages/buyer/BulkOrderForm'
import Catalog from '@/pages/buyer/Catalog'
import BuyerDashboard from '@/pages/buyer/Dashboard'
import OrderHistoryBuyer from '@/pages/buyer/OrderHistoryBuyer'
import ReliabilityScore from '@/pages/buyer/ReliabilityScore'
import BatchCreateStep1 from '@/pages/farmer/BatchCreateStep1'
import BatchCreateStep2 from '@/pages/farmer/BatchCreateStep2'
import BatchCreateStep3 from '@/pages/farmer/BatchCreateStep3'
import BatchDetail from '@/pages/farmer/BatchDetail'
import BatchList from '@/pages/farmer/BatchList'
import CertificateUpload from '@/pages/farmer/CertificateUpload'
import ContractDetail from '@/pages/farmer/ContractDetail'
import ContractsList from '@/pages/farmer/ContractsList'
import FarmerDashboard from '@/pages/farmer/Dashboard'
import Earnings from '@/pages/farmer/Earnings'
import QualityTestResult from '@/pages/farmer/QualityTestResult'
import TrustScore from '@/pages/farmer/TrustScore'
import NotBuiltYet from '@/pages/NotBuiltYet'
import Profile from '@/pages/shared/Profile'

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
  { label: 'New Procurement', path: '/buyer/orders/new', icon: FileText },
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
      <Route path="/" element={<Landing />} />
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verify-otp" element={<OtpVerification />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/scan/:qrHash" element={<QrScanResult />} />

      {/* Farmer PWA */}
      <Route element={<ProtectedRoute role="FARMER" />}>
        <Route element={<PWAShell title="BharatPure" tabs={FARMER_TABS} />}>
          <Route path="/farmer/dashboard" element={<FarmerDashboard />} />
          <Route path="/farmer/batches" element={<BatchList />} />
          <Route path="/farmer/batches/new/step-1" element={<BatchCreateStep1 />} />
          <Route path="/farmer/batches/new/step-2" element={<BatchCreateStep2 />} />
          <Route path="/farmer/batches/new/step-3" element={<BatchCreateStep3 />} />
          <Route path="/farmer/batches/:batchId" element={<BatchDetail />} />
          <Route path="/farmer/batches/:batchId/test-result" element={<QualityTestResult />} />
          <Route path="/farmer/batches/:batchId/upload-certificate" element={<CertificateUpload />} />
          <Route path="/farmer/earnings" element={<Earnings />} />
          <Route path="/farmer/contracts" element={<ContractsList />} />
          <Route path="/farmer/contracts/:contractId" element={<ContractDetail />} />
          <Route path="/farmer/trust-score" element={<TrustScore />} />
          <Route path="/farmer/profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Consumer PWA */}
      <Route element={<ProtectedRoute role="CONSUMER" />}>
        <Route element={<PWAShell title="BharatPure" tabs={CONSUMER_TABS} />}>
          <Route path="/consumer/browse" element={<Browse />} />
          <Route path="/consumer/listings/:listingId" element={<ProductDetail />} />
          <Route path="/consumer/scan" element={<QrScanner />} />
          <Route path="/consumer/cart" element={<Cart />} />
          <Route path="/consumer/orders/:orderId/confirmation" element={<OrderConfirmation />} />
          <Route path="/consumer/orders/:orderId/track" element={<OrderTracking />} />
          <Route path="/consumer/orders" element={<OrderHistory />} />
          <Route path="/consumer/subscriptions" element={<SubscriptionOverview />} />
          <Route path="/consumer/profile" element={<Profile />} />
        </Route>
      </Route>

      {/* Bulk Buyer web */}
      <Route element={<ProtectedRoute role="BULK_BUYER" />}>
        <Route element={<WebShell links={BUYER_LINKS} />}>
          <Route path="/buyer/dashboard" element={<BuyerDashboard />} />
          <Route path="/buyer/catalog" element={<Catalog />} />
          <Route path="/buyer/listings/:listingId" element={<BatchDetailBuyer />} />
          <Route path="/buyer/orders/new" element={<BulkOrderForm />} />
          <Route path="/buyer/orders" element={<OrderHistoryBuyer />} />
          <Route path="/buyer/reliability" element={<ReliabilityScore />} />
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
