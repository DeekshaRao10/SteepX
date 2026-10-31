import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor: attach auth tokens
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("steepx_auth_token");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor: structured errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      switch (status) {
        case 401:
          console.warn("API Error [401]: Unauthorized - Redirecting or clearing session");
          break;
        case 403:
          console.warn("API Error [403]: Forbidden - Insufficient role permissions");
          break;
        case 404:
          console.warn("API Error [404]: Resource not found");
          break;
        case 422:
          console.warn("API Error [422]: Validation failed", error.response.data);
          break;
        case 500:
          console.error("API Error [500]: Internal server error");
          break;
      }
    } else if (error.request) {
      console.warn("Network Error: No response received from server. Operating in mock fallback mode.");
    }
    return Promise.reject(error);
  }
);

export const USE_MOCK = true; // Set to false when FastAPI backend teammate connects

// Helper to simulate network latency for realistic SaaS feel
export const delay = (ms: number = 200) => new Promise((resolve) => setTimeout(resolve, ms));

