import { DashboardStats, RevenueDataPoint, StatusDistribution } from "@/types";
import { delay } from "./api";
import { storage } from "./storage";

export const dashboardService = {
  getStats: async (customerId?: string): Promise<DashboardStats> => {
    await delay(150);
    return storage.getDashboardStats(customerId);
  },

  getMonthlyRevenue: async (): Promise<RevenueDataPoint[]> => {
    await delay(150);
    return storage.getMonthlyRevenueData();
  },

  getStatusDistribution: async (): Promise<StatusDistribution[]> => {
    await delay(150);
    return storage.getSubscriptionStatusDistribution();
  },
};

