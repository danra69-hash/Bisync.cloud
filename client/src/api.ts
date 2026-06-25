const API_BASE = import.meta.env.VITE_API_URL ?? '';

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API error ${res.status}: ${path}`);
  return res.json();
}

export interface Location {
  id: number;
  externalId: string;
  name: string;
  address: string;
  salesToday: number;
  salesWtd: number;
  coversToday: number;
  coversWtd: number;
}

export interface MenuItem {
  id: number;
  name: string;
  category: string;
  orders: number;
  revenue: number;
  marginPercent: number;
}

export interface Vendor {
  id: number;
  externalId: string;
  name: string;
  type: string;
  products: string;
  city: string;
  engaged: boolean;
}

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  vendorName: string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  items: { id: number; name: string; quantity: number; unitPrice: number; unit: string }[];
}

export interface InventoryAlert {
  id: number;
  itemName: string;
  stock: string;
  status: string;
  threshold: string;
}

export interface RevenuePoint {
  id: number;
  period: string;
  label: string;
  currentValue: number;
  priorValue: number;
  covers?: number;
}

export interface ProgressData {
  overallPercent: number;
  completedCount: number;
  totalCount: number;
  lastUpdated: string;
  milestones: { phase: string; items: { id: number; title: string; status: string; progressPercent: number; notes?: string }[] }[];
}

export const api = {
  health: () => fetchJson<{ status: string }>('/api/health'),
  locations: () => fetchJson<Location[]>('/api/locations'),
  menu: (category?: string) => fetchJson<MenuItem[]>(`/api/menu${category ? `?category=${category}` : ''}`),
  vendors: (engaged?: boolean) => fetchJson<Vendor[]>(`/api/vendors${engaged !== undefined ? `?engaged=${engaged}` : ''}`),
  purchaseOrders: () => fetchJson<PurchaseOrder[]>('/api/purchaseorders'),
  inventoryAlerts: () => fetchJson<InventoryAlert[]>('/api/inventory/alerts'),
  revenue: (period = 'week') => fetchJson<RevenuePoint[]>(`/api/revenue?period=${period}`),
  progress: () => fetchJson<ProgressData>('/api/progress'),
};
