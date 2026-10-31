// Generated from the FastAPI OpenAPI contract. Run node scripts/generate-api-types.mjs.

export type CustomerAdminUpdate = {
  display_name?: string;
  company?: string;
  phone?: string;
  billing_address?: string;
  is_active?: boolean;
};

export type CustomerCreate = {
  display_name?: string;
  company?: string;
  phone?: string;
  billing_address?: string;
  is_active?: boolean;
  user_id: string;
};

export type CustomerResponse = {
  id: string;
  created_at: string;
  updated_at: string;
  email: string;
  display_name: string;
  company: string;
  phone: string;
  billing_address: string;
  is_active: boolean;
};

export type CustomerSnapshot = {
  display_name: string;
  company: string;
  billing_address: string;
  email: string;
};

export type CustomerUpdate = {
  display_name?: string;
  company?: string;
  phone?: string;
  billing_address?: string;
};

export type DashboardResponse = {
  currency: string;
  active_subscriptions: number;
  subscription_counts: Record<string, number>;
  revenue_collected: string;
  invoiced_total: string;
  outstanding_balance: string;
  overdue_invoice_count: number;
  overdue_amount: string;
  date_from: string | null;
  date_to: string | null;
};

export type DiscountResponse = {
  id: string;
  created_at: string;
  updated_at: string;
  code: string;
  kind: "fixed" | "percentage";
  value: string;
  currency?: string;
  minimum_purchase?: string;
  minimum_quantity?: number;
  starts_on?: string | null;
  ends_on?: string | null;
  usage_limit?: number | null;
  is_active?: boolean;
  used_count: number;
};

export type DiscountSnapshot = {
  code?: string | null;
  kind?: "fixed" | "percentage" | null;
  value?: string | null;
  eligibility?: string | null;
};

export type DiscountWrite = {
  code: string;
  kind: "fixed" | "percentage";
  value: number | string;
  currency?: string;
  minimum_purchase?: number | string;
  minimum_quantity?: number;
  starts_on?: string | null;
  ends_on?: string | null;
  usage_limit?: number | null;
  is_active?: boolean;
};

export type ErrorBody = {
  code: string;
  message: string;
  details?: (ErrorDetail)[];
};

export type ErrorDetail = {
  location: (string | number)[];
  code: string;
  message: string;
};

export type ErrorResponse = {
  error: ErrorBody;
};

export type HealthResponse = {
  status: "ok";
  service: "Brightloop Subscription API";
};

export type InvoiceGenerate = {
  period_start: string;
  issue_date?: string;
  due_date?: string | null;
};

export type InvoiceLineResponse = {
  id: string;
  position: number;
  plan_id: string;
  description: string;
  quantity: number;
  unit_price: string;
  tax_rate: string;
  selected_variants: (VariantSnapshot)[];
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
};

export type InvoiceResponse = {
  id: string;
  created_at: string;
  updated_at: string;
  invoice_number: string;
  customer_id: string;
  subscription_id: string;
  period_index: number;
  period_start: string;
  period_end: string;
  issue_date: string;
  due_date: string;
  status: "draft" | "confirmed" | "paid" | "overdue";
  currency: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  amount_paid: string;
  outstanding_balance: string;
  customer_snapshot: CustomerSnapshot;
  discount_snapshot: DiscountSnapshot;
  lines: (InvoiceLineResponse)[];
};

export type LineResponse = {
  id: string;
  position: number;
  plan_id: string;
  description: string;
  quantity: number;
  unit_price: string;
  tax_rate: string;
  selected_variants: (VariantSnapshot)[];
};

export type LineSelection = {
  plan_id: string;
  quantity?: number;
  variant_ids?: (string)[];
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type Page_CustomerResponse_ = {
  items: (CustomerResponse)[];
  total: number;
  limit: number;
  offset: number;
};

export type Page_DiscountResponse_ = {
  items: (DiscountResponse)[];
  total: number;
  limit: number;
  offset: number;
};

export type Page_InvoiceResponse_ = {
  items: (InvoiceResponse)[];
  total: number;
  limit: number;
  offset: number;
};

export type Page_PaymentResponse_ = {
  items: (PaymentResponse)[];
  total: number;
  limit: number;
  offset: number;
};

export type Page_PlanResponse_ = {
  items: (PlanResponse)[];
  total: number;
  limit: number;
  offset: number;
};

export type Page_ProductResponse_ = {
  items: (ProductResponse)[];
  total: number;
  limit: number;
  offset: number;
};

export type Page_QuotationResponse_ = {
  items: (QuotationResponse)[];
  total: number;
  limit: number;
  offset: number;
};

export type Page_SubscriptionResponse_ = {
  items: (SubscriptionResponse)[];
  total: number;
  limit: number;
  offset: number;
};

export type Page_TaxResponse_ = {
  items: (TaxResponse)[];
  total: number;
  limit: number;
  offset: number;
};

export type Page_TemplateResponse_ = {
  items: (TemplateResponse)[];
  total: number;
  limit: number;
  offset: number;
};

export type Page_UserResponse_ = {
  items: (UserResponse)[];
  total: number;
  limit: number;
  offset: number;
};

export type Page_VariantResponse_ = {
  items: (VariantResponse)[];
  total: number;
  limit: number;
  offset: number;
};

export type PaymentCreate = {
  invoice_id: string;
  amount: number | string;
  method: "cash" | "bank_transfer" | "check" | "other";
  payment_date: string;
  notes?: string;
  reference?: string | null;
};

export type PaymentResponse = {
  id: string;
  created_at: string;
  updated_at: string;
  invoice_id: string;
  recorded_by: string;
  amount: string;
  method: string;
  payment_date: string;
  notes: string;
  reference: string | null;
};

export type PlanResponse = {
  id: string;
  created_at: string;
  updated_at: string;
  product_id: string;
  tax_rate_id?: string | null;
  name: string;
  description?: string;
  price: string;
  billing_interval: "daily" | "weekly" | "monthly" | "yearly";
  minimum_quantity?: number;
  available_from?: string | null;
  available_until?: string | null;
  end_behavior?: "renew" | "close";
  is_active?: boolean;
  currency: string;
  product_name: string;
};

export type PlanWrite = {
  product_id: string;
  tax_rate_id?: string | null;
  name: string;
  description?: string;
  price: number | string;
  billing_interval: "daily" | "weekly" | "monthly" | "yearly";
  minimum_quantity?: number;
  available_from?: string | null;
  available_until?: string | null;
  end_behavior?: "renew" | "close";
  is_active?: boolean;
};

export type ProductResponse = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  type: string;
  sales_price: string;
  cost: string;
  currency?: string;
  notes?: string;
  is_active?: boolean;
};

export type ProductWrite = {
  name: string;
  type: string;
  sales_price: number | string;
  cost: number | string;
  currency?: string;
  notes?: string;
  is_active?: boolean;
};

export type QuotationResponse = {
  id: string;
  created_at: string;
  updated_at: string;
  customer_id: string;
  discount_id: string | null;
  template_id: string | null;
  state: "draft" | "quotation" | "confirmed" | "active" | "closed";
  is_expired: boolean;
  currency: string;
  billing_interval: "daily" | "weekly" | "monthly" | "yearly";
  end_behavior: "renew" | "close";
  start_date: string;
  end_date: string | null;
  valid_until: string;
  notes: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  lines: (LineResponse)[];
};

export type QuotationWrite = {
  customer_id?: string | null;
  template_id?: string | null;
  lines?: (LineSelection)[];
  start_date?: string;
  end_date?: string | null;
  valid_until?: string | null;
  notes?: string;
  discount_code?: string | null;
};

export type RegisterRequest = {
  email: string;
  password: string;
  display_name?: string;
  company?: string;
  phone?: string;
  billing_address?: string;
};

export type RenewalRequest = {
  start_date?: string;
  end_date?: string | null;
};

export type RevenuePoint = {
  period: string;
  collected: string;
};

export type RevenueReport = {
  currency: string;
  date_from: string;
  date_to: string;
  granularity: string;
  items: (RevenuePoint)[];
};

export type SubscriptionCreate = {
  quotation_id: string;
};

export type SubscriptionResponse = {
  id: string;
  created_at: string;
  updated_at: string;
  customer_id: string;
  discount_id: string | null;
  quotation_id: string | null;
  renewed_from_id: string | null;
  state: "confirmed" | "active" | "paused" | "closed";
  currency: string;
  billing_interval: "daily" | "weekly" | "monthly" | "yearly";
  end_behavior: "renew" | "close";
  start_date: string;
  term_end: string | null;
  closed_on: string | null;
  paused_at: string | null;
  next_period_index: number;
  next_billing_date: string;
  lines: (LineResponse)[];
};

export type TaxResponse = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  rate: string;
  description?: string;
  is_active?: boolean;
};

export type TaxWrite = {
  name: string;
  rate: number | string;
  description?: string;
  is_active?: boolean;
};

export type TemplateResponse = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  notes?: string;
  selections: (LineSelection)[];
  validity_days?: number;
  is_active?: boolean;
};

export type TemplateWrite = {
  name: string;
  notes?: string;
  selections: (LineSelection)[];
  validity_days?: number;
  is_active?: boolean;
};

export type TokenResponse = {
  access_token: string;
  token_type?: "bearer";
  expires_in: number;
};

export type UserResponse = {
  id: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UserRole = "admin" | "staff" | "customer";

export type VariantResponse = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  kind: "variant" | "addon";
  additional_price: string;
  is_active?: boolean;
  product_id: string;
};

export type VariantSnapshot = {
  id: string;
  name: string;
  kind: string;
  additional_price: string;
};

export type VariantWrite = {
  name: string;
  kind: "variant" | "addon";
  additional_price: number | string;
  is_active?: boolean;
};
