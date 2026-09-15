export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'allocation_pending'
  | 'allocated'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'disputed'

export interface DeliveryAddress {
  line1: string
  line2?: string
  city: string
  state: string
  pincode: string
  lat?: number
  lng?: number
}

export interface OrderItem {
  id: string
  listing_id: string
  batch_id: string
  quantity_kg: number
  price_per_kg_paise: number
  subtotal_paise: number
}

export interface Order {
  id: string
  buyer_id: string
  buyer_role: 'CONSUMER' | 'BULK_BUYER'
  total_amount_paise: number
  status: OrderStatus
  delivery_address: DeliveryAddress
  delivery_notes: string | null
  estimated_delivery_at: string | null
  actual_delivery_at: string | null
  created_at: string
  items?: OrderItem[]
}

export interface OrderTracking {
  order_status: OrderStatus
  driver_name: string | null
  vehicle_id: string | null
  current_stop: { name: string; sequence: number } | null
  next_stop: { name: string; estimated_arrival: string } | null
  temperature_status: 'maintained' | 'breach' | null
  last_temp_reading_c: number | null
}
