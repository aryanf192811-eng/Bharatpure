export interface CartItem {
  listingId: string
  batchCode: string
  cropType: string
  fpoName: string
  pricePerKgPaise: number
  minOrderKg: number
  maxOrderKg: number | null
  quantityKg: number
}
