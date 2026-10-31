import {
  Product,
  SubscriptionPlan,
  Customer,
  Subscription,
  Quotation,
  Invoice,
  Payment,
  Discount,
  User,
  DashboardStats,
  RevenueDataPoint,
  StatusDistribution,
} from "@/types";
import {
  INITIAL_PRODUCTS,
  INITIAL_PLANS,
  INITIAL_CUSTOMERS,
  INITIAL_SUBSCRIPTIONS,
  INITIAL_QUOTATIONS,
  INITIAL_INVOICES,
  INITIAL_PAYMENTS,
  INITIAL_DISCOUNTS,
  INITIAL_USERS,
} from "./mockData";

const STORAGE_KEYS = {
  PRODUCTS: "steepx_products",
  PLANS: "steepx_plans",
  CUSTOMERS: "steepx_customers",
  SUBSCRIPTIONS: "steepx_subscriptions",
  QUOTATIONS: "steepx_quotations",
  INVOICES: "steepx_invoices",
  PAYMENTS: "steepx_payments",
  DISCOUNTS: "steepx_discounts",
  USERS: "steepx_users",
  CURRENT_USER: "steepx_current_user",
};

// In-memory fallback for SSR
let memoryStore: Record<string, any> = {
  [STORAGE_KEYS.PRODUCTS]: INITIAL_PRODUCTS,
  [STORAGE_KEYS.PLANS]: INITIAL_PLANS,
  [STORAGE_KEYS.CUSTOMERS]: INITIAL_CUSTOMERS,
  [STORAGE_KEYS.SUBSCRIPTIONS]: INITIAL_SUBSCRIPTIONS,
  [STORAGE_KEYS.QUOTATIONS]: INITIAL_QUOTATIONS,
  [STORAGE_KEYS.INVOICES]: INITIAL_INVOICES,
  [STORAGE_KEYS.PAYMENTS]: INITIAL_PAYMENTS,
  [STORAGE_KEYS.DISCOUNTS]: INITIAL_DISCOUNTS,
  [STORAGE_KEYS.USERS]: INITIAL_USERS,
  [STORAGE_KEYS.CURRENT_USER]: INITIAL_USERS[0],
};

function isClient(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function getItem<T>(key: string, defaultValue: T): T {
  if (!isClient()) {
    return memoryStore[key] ?? defaultValue;
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      window.localStorage.setItem(key, JSON.stringify(defaultValue));
      return defaultValue;
    }
    return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`Failed to read ${key} from localStorage`, e);
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  if (!isClient()) {
    memoryStore[key] = value;
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Failed to write ${key} to localStorage`, e);
  }
}

export const storage = {
  // Reset all data to factory demo state
  resetAll: () => {
    if (isClient()) {
      window.localStorage.clear();
    }
    memoryStore = {
      [STORAGE_KEYS.PRODUCTS]: INITIAL_PRODUCTS,
      [STORAGE_KEYS.PLANS]: INITIAL_PLANS,
      [STORAGE_KEYS.CUSTOMERS]: INITIAL_CUSTOMERS,
      [STORAGE_KEYS.SUBSCRIPTIONS]: INITIAL_SUBSCRIPTIONS,
      [STORAGE_KEYS.QUOTATIONS]: INITIAL_QUOTATIONS,
      [STORAGE_KEYS.INVOICES]: INITIAL_INVOICES,
      [STORAGE_KEYS.PAYMENTS]: INITIAL_PAYMENTS,
      [STORAGE_KEYS.DISCOUNTS]: INITIAL_DISCOUNTS,
      [STORAGE_KEYS.USERS]: INITIAL_USERS,
      [STORAGE_KEYS.CURRENT_USER]: INITIAL_USERS[0],
    };
    if (isClient()) {
      Object.entries(memoryStore).forEach(([k, v]) => {
        window.localStorage.setItem(k, JSON.stringify(v));
      });
    }
  },

  // USERS
  getUsers: (): User[] => getItem<User[]>(STORAGE_KEYS.USERS, INITIAL_USERS),
  getCurrentUser: (): User => getItem<User>(STORAGE_KEYS.CURRENT_USER, INITIAL_USERS[0]),
  setCurrentUser: (user: User) => setItem<User>(STORAGE_KEYS.CURRENT_USER, user),

  // PRODUCTS
  getProducts: (): Product[] => getItem<Product[]>(STORAGE_KEYS.PRODUCTS, INITIAL_PRODUCTS),
  getProductById: (id: string): Product | undefined => {
    return storage.getProducts().find((p) => p.id === id);
  },
  createProduct: (product: Omit<Product, "id" | "createdAt" | "updatedAt">): Product => {
    const products = storage.getProducts();
    const newProduct: Product = {
      ...product,
      id: `PROD-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setItem(STORAGE_KEYS.PRODUCTS, [newProduct, ...products]);
    return newProduct;
  },
  updateProduct: (id: string, updates: Partial<Product>): Product => {
    const products = storage.getProducts();
    const index = products.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("Product not found");
    const updated = { ...products[index], ...updates, updatedAt: new Date().toISOString() };
    products[index] = updated;
    setItem(STORAGE_KEYS.PRODUCTS, [...products]);
    return updated;
  },
  deleteProduct: (id: string): boolean => {
    const products = storage.getProducts().filter((p) => p.id !== id);
    setItem(STORAGE_KEYS.PRODUCTS, products);
    return true;
  },

  // PLANS
  getPlans: (): SubscriptionPlan[] => getItem<SubscriptionPlan[]>(STORAGE_KEYS.PLANS, INITIAL_PLANS),
  getPlanById: (id: string): SubscriptionPlan | undefined => {
    return storage.getPlans().find((p) => p.id === id);
  },
  createPlan: (plan: Omit<SubscriptionPlan, "id" | "createdAt">): SubscriptionPlan => {
    const plans = storage.getPlans();
    const newPlan: SubscriptionPlan = {
      ...plan,
      id: `PLAN-${Math.floor(200 + Math.random() * 800)}`,
      createdAt: new Date().toISOString(),
    };
    setItem(STORAGE_KEYS.PLANS, [newPlan, ...plans]);
    return newPlan;
  },
  updatePlan: (id: string, updates: Partial<SubscriptionPlan>): SubscriptionPlan => {
    const plans = storage.getPlans();
    const index = plans.findIndex((p) => p.id === id);
    if (index === -1) throw new Error("Plan not found");
    const updated = { ...plans[index], ...updates };
    plans[index] = updated;
    setItem(STORAGE_KEYS.PLANS, [...plans]);
    return updated;
  },
  deletePlan: (id: string): boolean => {
    const plans = storage.getPlans().filter((p) => p.id !== id);
    setItem(STORAGE_KEYS.PLANS, plans);
    return true;
  },

  // CUSTOMERS
  getCustomers: (): Customer[] => getItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS),
  getCustomerById: (id: string): Customer | undefined => {
    return storage.getCustomers().find((c) => c.id === id);
  },
  createCustomer: (customer: Omit<Customer, "id" | "createdAt" | "totalSpent" | "activeSubscriptionsCount">): Customer => {
    const customers = storage.getCustomers();
    const newCustomer: Customer = {
      ...customer,
      id: `CUST-${Math.floor(100 + Math.random() * 900)}`,
      totalSpent: 0,
      activeSubscriptionsCount: 0,
      createdAt: new Date().toISOString(),
    };
    setItem(STORAGE_KEYS.CUSTOMERS, [newCustomer, ...customers]);
    return newCustomer;
  },
  updateCustomer: (id: string, updates: Partial<Customer>): Customer => {
    const customers = storage.getCustomers();
    const index = customers.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Customer not found");
    const updated = { ...customers[index], ...updates };
    customers[index] = updated;
    setItem(STORAGE_KEYS.CUSTOMERS, [...customers]);
    return updated;
  },
  deleteCustomer: (id: string): boolean => {
    const customers = storage.getCustomers().filter((c) => c.id !== id);
    setItem(STORAGE_KEYS.CUSTOMERS, customers);
    return true;
  },

  // SUBSCRIPTIONS
  getSubscriptions: (): Subscription[] => getItem<Subscription[]>(STORAGE_KEYS.SUBSCRIPTIONS, INITIAL_SUBSCRIPTIONS),
  getSubscriptionById: (id: string): Subscription | undefined => {
    return storage.getSubscriptions().find((s) => s.id === id);
  },
  createSubscription: (sub: Omit<Subscription, "id" | "subscriptionNumber" | "createdAt">): Subscription => {
    const subs = storage.getSubscriptions();
    const nextSeq = subs.length + 1;
    const newSub: Subscription = {
      ...sub,
      id: `SUB-${Math.floor(300 + Math.random() * 700)}`,
      subscriptionNumber: `SUB-2026-${String(nextSeq).padStart(3, "0")}`,
      createdAt: new Date().toISOString(),
    };
    setItem(STORAGE_KEYS.SUBSCRIPTIONS, [newSub, ...subs]);

    // Recalculate customer active subscriptions
    storage.refreshCustomerStats(newSub.customerId);
    return newSub;
  },
  updateSubscription: (id: string, updates: Partial<Subscription>): Subscription => {
    const subs = storage.getSubscriptions();
    const index = subs.findIndex((s) => s.id === id);
    if (index === -1) throw new Error("Subscription not found");
    const updated = { ...subs[index], ...updates };
    subs[index] = updated;
    setItem(STORAGE_KEYS.SUBSCRIPTIONS, [...subs]);

    storage.refreshCustomerStats(updated.customerId);
    return updated;
  },
  deleteSubscription: (id: string): boolean => {
    const sub = storage.getSubscriptionById(id);
    const customerId = sub?.customerId;
    const subs = storage.getSubscriptions().filter((s) => s.id !== id);
    setItem(STORAGE_KEYS.SUBSCRIPTIONS, subs);
    if (customerId) storage.refreshCustomerStats(customerId);
    return true;
  },

  // QUOTATIONS
  getQuotations: (): Quotation[] => getItem<Quotation[]>(STORAGE_KEYS.QUOTATIONS, INITIAL_QUOTATIONS),
  getQuotationById: (id: string): Quotation | undefined => {
    return storage.getQuotations().find((q) => q.id === id);
  },
  createQuotation: (quotation: Omit<Quotation, "id" | "quotationNumber" | "createdAt">): Quotation => {
    const quots = storage.getQuotations();
    const nextSeq = quots.length + 1;
    const newQuotation: Quotation = {
      ...quotation,
      id: `QUOT-${Math.floor(400 + Math.random() * 600)}`,
      quotationNumber: `QUOT-2026-${String(nextSeq).padStart(3, "0")}`,
      createdAt: new Date().toISOString(),
    };
    setItem(STORAGE_KEYS.QUOTATIONS, [newQuotation, ...quots]);
    return newQuotation;
  },
  updateQuotation: (id: string, updates: Partial<Quotation>): Quotation => {
    const quots = storage.getQuotations();
    const index = quots.findIndex((q) => q.id === id);
    if (index === -1) throw new Error("Quotation not found");
    const updated = { ...quots[index], ...updates };
    quots[index] = updated;
    setItem(STORAGE_KEYS.QUOTATIONS, [...quots]);
    return updated;
  },
  deleteQuotation: (id: string): boolean => {
    const quots = storage.getQuotations().filter((q) => q.id !== id);
    setItem(STORAGE_KEYS.QUOTATIONS, quots);
    return true;
  },

  // INVOICES
  getInvoices: (): Invoice[] => getItem<Invoice[]>(STORAGE_KEYS.INVOICES, INITIAL_INVOICES),
  getInvoiceById: (id: string): Invoice | undefined => {
    return storage.getInvoices().find((i) => i.id === id);
  },
  createInvoice: (invoice: Omit<Invoice, "id" | "invoiceNumber" | "paidAmount" | "balanceAmount" | "createdAt">): Invoice => {
    const invoices = storage.getInvoices();
    const nextSeq = invoices.length + 1;
    const newInvoice: Invoice = {
      ...invoice,
      id: `INV-${Math.floor(500 + Math.random() * 500)}`,
      invoiceNumber: `INV-2026-${String(nextSeq).padStart(3, "0")}`,
      paidAmount: 0,
      balanceAmount: invoice.totalAmount,
      createdAt: new Date().toISOString(),
    };
    setItem(STORAGE_KEYS.INVOICES, [newInvoice, ...invoices]);
    return newInvoice;
  },
  updateInvoice: (id: string, updates: Partial<Invoice>): Invoice => {
    const invoices = storage.getInvoices();
    const index = invoices.findIndex((i) => i.id === id);
    if (index === -1) throw new Error("Invoice not found");
    const updated = { ...invoices[index], ...updates };
    invoices[index] = updated;
    setItem(STORAGE_KEYS.INVOICES, [...invoices]);
    return updated;
  },
  deleteInvoice: (id: string): boolean => {
    const invoices = storage.getInvoices().filter((i) => i.id !== id);
    setItem(STORAGE_KEYS.INVOICES, invoices);
    return true;
  },

  // PAYMENTS
  getPayments: (): Payment[] => getItem<Payment[]>(STORAGE_KEYS.PAYMENTS, INITIAL_PAYMENTS),
  createPayment: (paymentData: Omit<Payment, "id" | "paymentNumber" | "createdAt">): Payment => {
    const payments = storage.getPayments();
    const nextSeq = payments.length + 1;
    const newPayment: Payment = {
      ...paymentData,
      id: `PAY-${Math.floor(700 + Math.random() * 300)}`,
      paymentNumber: `PAY-2026-${String(nextSeq).padStart(3, "0")}`,
      createdAt: new Date().toISOString(),
    };
    setItem(STORAGE_KEYS.PAYMENTS, [newPayment, ...payments]);

    // Update associated invoice balance and status
    if (newPayment.invoiceId && newPayment.status === "completed") {
      const invoice = storage.getInvoiceById(newPayment.invoiceId);
      if (invoice) {
        const newPaid = invoice.paidAmount + newPayment.amount;
        const newBalance = Math.max(0, invoice.totalAmount - newPaid);
        const newStatus = newBalance <= 0 ? "paid" : newPaid > 0 ? "partially_paid" : invoice.status;

        storage.updateInvoice(invoice.id, {
          paidAmount: newPaid,
          balanceAmount: newBalance,
          status: newStatus,
        });

        // Update customer total spent
        storage.refreshCustomerStats(invoice.customerId);
      }
    }

    return newPayment;
  },

  // DISCOUNTS
  getDiscounts: (): Discount[] => getItem<Discount[]>(STORAGE_KEYS.DISCOUNTS, INITIAL_DISCOUNTS),
  getDiscountById: (id: string): Discount | undefined => {
    return storage.getDiscounts().find((d) => d.id === id);
  },
  createDiscount: (discount: Omit<Discount, "id" | "usedCount" | "createdAt">): Discount => {
    const discounts = storage.getDiscounts();
    const newDiscount: Discount = {
      ...discount,
      id: `DISC-${Math.floor(600 + Math.random() * 400)}`,
      usedCount: 0,
      createdAt: new Date().toISOString(),
    };
    setItem(STORAGE_KEYS.DISCOUNTS, [newDiscount, ...discounts]);
    return newDiscount;
  },
  updateDiscount: (id: string, updates: Partial<Discount>): Discount => {
    const discounts = storage.getDiscounts();
    const index = discounts.findIndex((d) => d.id === id);
    if (index === -1) throw new Error("Discount not found");
    const updated = { ...discounts[index], ...updates };
    discounts[index] = updated;
    setItem(STORAGE_KEYS.DISCOUNTS, [...discounts]);
    return updated;
  },
  deleteDiscount: (id: string): boolean => {
    const discounts = storage.getDiscounts().filter((d) => d.id !== id);
    setItem(STORAGE_KEYS.DISCOUNTS, discounts);
    return true;
  },

  // HELPER: Sync customer stats (active subscriptions count & total spent)
  refreshCustomerStats: (customerId: string) => {
    const customers = storage.getCustomers();
    const subs = storage.getSubscriptions();
    const payments = storage.getPayments();

    const customerSubs = subs.filter((s) => s.customerId === customerId && (s.status === "active" || s.status === "confirmed"));
    const customerPayments = payments.filter((p) => p.customerId === customerId && p.status === "completed");

    const totalSpent = customerPayments.reduce((sum, p) => sum + p.amount, 0);

    const index = customers.findIndex((c) => c.id === customerId);
    if (index !== -1) {
      customers[index] = {
        ...customers[index],
        activeSubscriptionsCount: customerSubs.length,
        totalSpent: Math.round(totalSpent * 100) / 100,
      };
      setItem(STORAGE_KEYS.CUSTOMERS, [...customers]);
    }
  },

  // DASHBOARD METRICS CALCULATION
  getDashboardStats: (customerId?: string): DashboardStats => {
    let subs = storage.getSubscriptions();
    let invoices = storage.getInvoices();
    let payments = storage.getPayments();
    let customers = storage.getCustomers();
    let plans = storage.getPlans();

    if (customerId) {
      subs = subs.filter((s) => s.customerId === customerId);
      invoices = invoices.filter((i) => i.customerId === customerId);
      payments = payments.filter((p) => p.customerId === customerId);
    }

    const activeSubs = subs.filter((s) => s.status === "active").length;
    const revenue = payments
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + p.amount, 0);

    const outstanding = invoices
      .filter((i) => i.status === "unpaid" || i.status === "partially_paid" || i.status === "overdue")
      .reduce((sum, i) => sum + i.balanceAmount, 0);

    const overdueCount = invoices.filter((i) => i.status === "overdue").length;

    return {
      totalActiveSubscriptions: activeSubs,
      subscriptionsChangePercent: 12.5,
      revenueCollected: Math.round(revenue * 100) / 100,
      revenueChangePercent: 18.2,
      outstandingAmount: Math.round(outstanding * 100) / 100,
      overdueInvoicesCount: overdueCount,
      totalCustomersCount: customers.length,
      activePlansCount: plans.filter((p) => p.status === "active").length,
    };
  },

  // MONTHLY REVENUE CHART DATA
  getMonthlyRevenueData: (): RevenueDataPoint[] => {
    return [
      { month: "Sep", revenue: 2400, invoiced: 2900 },
      { month: "Oct", revenue: 3100, invoiced: 3400 },
      { month: "Nov", revenue: 4200, invoiced: 4600 },
      { month: "Dec", revenue: 4800, invoiced: 5100 },
      { month: "Jan", revenue: 5600, invoiced: 6200 },
      { month: "Feb", revenue: 6450, invoiced: 7100 },
    ];
  },

  // SUBSCRIPTION STATUS DISTRIBUTION
  getSubscriptionStatusDistribution: (): StatusDistribution[] => {
    const subs = storage.getSubscriptions();
    const statusCounts: Record<string, number> = {};
    subs.forEach((s) => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });

    const colorMap: Record<string, string> = {
      active: "#10b981",    // Emerald
      confirmed: "#3b82f6", // Blue
      quotation: "#f59e0b", // Amber
      draft: "#64748b",     // Slate
      paused: "#8b5cf6",    // Purple
      closed: "#ef4444",    // Rose
    };

    return Object.entries(statusCounts).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      count,
      color: colorMap[status] || "#94a3b8",
    }));
  },
};

