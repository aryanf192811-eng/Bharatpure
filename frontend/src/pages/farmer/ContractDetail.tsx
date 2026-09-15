import { Navigate } from 'react-router-dom'

// Unreachable in practice -- ContractsList has no rows to link into, since contracts are
// deferred (see ContractsList.tsx). Redirects rather than 404ing if a stale link is followed.
export default function ContractDetail() {
  return <Navigate to="/farmer/contracts" replace />
}
