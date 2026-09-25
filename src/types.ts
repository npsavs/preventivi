export interface Client {
  id: string
  name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  zip: string | null
  province: string | null
}

export interface Category {
  id: string
  name: string
  sort_order: number
}

export interface Material {
  id: string
  category_id: string
  name: string
  description: string | null
  unit: string | null
  unit_price: number
}

export interface Quote {
  id: string
  created_at: string
  quote_number: string | null
  client_id: string | null
  notes: string | null
  status: string | null
}

export interface QuoteItem {
  id: string
  quote_id: string
  material_id: string | null
  category_name: string | null
  name: string
  quantity: number
  unit: string | null
  unit_price: number
}