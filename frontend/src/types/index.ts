// SteepX - Types & Interfaces

export type UserRole = 'ADMIN' | 'STAFF' | 'CUSTOMER';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  company?: string;
  customerId?: string; // If customer role, linked customer ID
  createdAt: string;
}

export type ProductType = 'software' | 'service' | 'hardware' | 'usage';

export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  priceDelta: number;
}

export interface ProductAddOn {
  id: string;
  name: string;
  price: number;
  description: string;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  type: ProductType;
  salesPrice: number;
  costPrice: number;
  description: string;
  status: 'active' | 'archived';
  variants: ProductVariant[];
  addOns: ProductAddOn[];
  createdAt: string;
  updatedAt: string;
}

export type BillingInterval = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type PlanEndBehavior = 'auto_renew' | 'cancel' | 'pause';

export interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  productId: string;
  productName: string;
  billingInterval: BillingInterval;
  price: number;
  minimumQuantity: number;
  availabilityStartDate: string;
  availabilityEndDate: string;
  endBehavior: PlanEndBehavior;
  features: string[];
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  address: Address;
  taxNumber?: string;
  status: 'active' | 'inactive' | 'suspended';
  totalSpent: number;
  activeSubscriptionsCount: number;
  notes?: string;
  createdAt: string;
}

export type SubscriptionStatus = 'draft' | 'quotation' | 'confirmed' | 'active' | 'paused' | 'closed';

export interface SubscriptionSelectedAddon {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Subscription {
  id: string;
  subscriptionNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  productId: string;
  productName: string;
  planId: string;
  planName: string;
  quantity: number;
  billingInterval: BillingInterval;
  unitPrice: number;
  amount: number;
  addOns: SubscriptionSelectedAddon[];
  startDate: string;
  endDate: string;
  nextBillingDate: string;
  status: SubscriptionStatus;
  autoRenew: boolean;
  notes?: string;
  createdAt: string;
}

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted';

export interface QuotationItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  total: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  subscriptionId?: string;
  items: QuotationItem[];
  subtotal: number;
  taxRate: number; // e.g., 10 for 10%
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  validityDate: string;
  status: QuotationStatus;
  notes?: string;
  createdAt: string;
}

export type InvoiceStatus = 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  subscriptionId?: string;
  subscriptionNumber?: string;
  items: InvoiceItem[];
  issueDate: string;
  dueDate: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: InvoiceStatus;
  paymentTerms: string;
  notes?: string;
  createdAt: string;
}

export type DiscountType = 'percentage' | 'fixed';

export interface Discount {
  id: string;
  code: string;
  name: string;
  type: DiscountType;
  value: number; // percentage (e.g., 15 for 15%) or fixed dollar amount
  minPurchaseAmount?: number;
  minQuantity?: number;
  startDate: string;
  expiryDate: string;
  usageLimit?: number;
  usedCount: number;
  status: 'active' | 'expired' | 'disabled';
  createdAt: string;
}

export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'stripe' | 'paypal' | 'cash';
export type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  paymentNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  status: PaymentStatus;
  transactionRef: string;
  notes?: string;
  createdAt: string;
}

export interface DashboardStats {
  totalActiveSubscriptions: number;
  subscriptionsChangePercent: number;
  revenueCollected: number;
  revenueChangePercent: number;
  outstandingAmount: number;
  overdueInvoicesCount: number;
  totalCustomersCount: number;
  activePlansCount: number;
}

export interface RevenueDataPoint {
  month: string;
  revenue: number;
  invoiced: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
  color: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  timestamp: string;
  read: boolean;
  link?: string;
}

