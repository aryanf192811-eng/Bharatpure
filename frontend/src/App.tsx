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
import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import type { PWATab } from '@/components/layout/PWAShell'
import { PWAShell } from '@/components/layout/PWAShell'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'
import type { WebNavLink } from '@/components/layout/WebShell'
import { WebShell } from '@/components/layout/WebShell'
import { Skeleton } from '@/components/ui/skeleton'

// Every screen is its own chunk -- lazy-loaded per route rather than bundled eagerly. This is
// what actually addresses the bundle-size gap (recharts/leaflet/html5-qrcode were all being
// pulled into the main chunk regardless of which role/screen a session ever visits).
const Landing = lazy(() => import('@/pages/auth/Landing'))
const Register = lazy(() => import('@/pages/auth/Register'))
const Login = lazy(() => import('@/pages/auth/Login'))
const OtpVerification = lazy(() => import('@/pages/auth/OtpVerification'))
const ForgotPassword = lazy(() => import('@/pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/auth/ResetPassword'))
const QrScanResult = lazy(() => import('@/pages/consumer/QrScanResult'))

const FarmerDashboard = lazy(() => import('@/pages/farmer/Dashboard'))
const BatchList = lazy(() => import('@/pages/farmer/BatchList'))
const BatchCreateStep1 = lazy(() => import('@/pages/farmer/BatchCreateStep1'))
const BatchCreateStep2 = lazy(() => import('@/pages/farmer/BatchCreateStep2'))
const BatchCreateStep3 = lazy(() => import('@/pages/farmer/BatchCreateStep3'))
const BatchDetail = lazy(() => import('@/pages/farmer/BatchDetail'))
const QualityTestResult = lazy(() => import('@/pages/farmer/QualityTestResult'))
const CertificateUpload = lazy(() => import('@/pages/farmer/CertificateUpload'))
const Earnings = lazy(() => import('@/pages/farmer/Earnings'))
const ContractsList = lazy(() => import('@/pages/farmer/ContractsList'))
const ContractDetail = lazy(() => import('@/pages/farmer/ContractDetail'))
const TrustScore = lazy(() => import('@/pages/farmer/TrustScore'))

const Browse = lazy(() => import('@/pages/consumer/Browse'))
const ProductDetail = lazy(() => import('@/pages/consumer/ProductDetail'))
const QrScanner = lazy(() => import('@/pages/consumer/QrScanner'))
const Cart = lazy(() => import('@/pages/consumer/Cart'))
const OrderConfirmation = lazy(() => import('@/pages/consumer/OrderConfirmation'))
const OrderTracking = lazy(() => import('@/pages/consumer/OrderTracking'))
const OrderHistory = lazy(() => import('@/pages/consumer/OrderHistory'))
const SubscriptionOverview = lazy(() => import('@/pages/consumer/SubscriptionOverview'))

const BuyerDashboard = lazy(() => import('@/pages/buyer/Dashboard'))
const Catalog = lazy(() => import('@/pages/buyer/Catalog'))
const BatchDetailBuyer = lazy(() => import('@/pages/buyer/BatchDetailBuyer'))
const BulkOrderForm = lazy(() => import('@/pages/buyer/BulkOrderForm'))
const OrderHistoryBuyer = lazy(() => import('@/pages/buyer/OrderHistoryBuyer'))
const ReliabilityScore = lazy(() => import('@/pages/buyer/ReliabilityScore'))

const LogisticsDashboard = lazy(() => import('@/pages/logistics/Dashboard'))
const RoutesList = lazy(() => import('@/pages/logistics/RoutesList'))
const RouteMapView = lazy(() => import('@/pages/logistics/RouteMapView'))
const StopDetail = lazy(() => import('@/pages/logistics/StopDetail'))
const TemperatureLogEntry = lazy(() => import('@/pages/logistics/TemperatureLogEntry'))
const DeliveryConfirmation = lazy(() => import('@/pages/logistics/DeliveryConfirmation'))

const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const DemandIntelligence = lazy(() => import('@/pages/admin/DemandIntelligence'))
const PriceIntelligence = lazy(() => import('@/pages/admin/PriceIntelligence'))
const RouteOptimization = lazy(() => import('@/pages/admin/RouteOptimization'))
const WhatIfSimulator = lazy(() => import('@/pages/admin/WhatIfSimulator'))
const FpoBatchManagement = lazy(() => import('@/pages/admin/FpoBatchManagement'))
const EscrowManagement = lazy(() => import('@/pages/admin/EscrowManagement'))
const DpiStatus = lazy(() => import('@/pages/admin/DpiStatus'))
const AuditLogViewer = lazy(() => import('@/pages/admin/AuditLogViewer'))

const Profile = lazy(() => import('@/pages/shared/Profile'))

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <Skeleton className="h-40 w-full max-w-md" />
    </div>
  )
}

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
    <Suspense fallback={<RouteLoadingFallback />}>
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
            <Route path="/logistics/dashboard" element={<LogisticsDashboard />} />
            <Route path="/logistics/routes" element={<RoutesList />} />
            <Route path="/logistics/routes/:routeId" element={<RouteMapView />} />
            <Route path="/logistics/routes/:routeId/stops/:stopId" element={<StopDetail />} />
            <Route path="/logistics/temperature-log" element={<TemperatureLogEntry />} />
            <Route path="/logistics/deliver/:orderId" element={<DeliveryConfirmation />} />
            <Route path="/logistics/profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Admin web */}
        <Route element={<ProtectedRoute role="ADMIN" />}>
          <Route element={<WebShell links={ADMIN_LINKS} />}>
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/demand" element={<DemandIntelligence />} />
            <Route path="/admin/price" element={<PriceIntelligence />} />
            <Route path="/admin/routes" element={<RouteOptimization />} />
            <Route path="/admin/simulate" element={<WhatIfSimulator />} />
            <Route path="/admin/fpos" element={<FpoBatchManagement />} />
            <Route path="/admin/escrow" element={<EscrowManagement />} />
            <Route path="/admin/dpi" element={<DpiStatus />} />
            <Route path="/admin/audit" element={<AuditLogViewer />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
