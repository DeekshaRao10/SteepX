import { Product } from "@/types";
import { ProductResponse, ProductWrite, VariantResponse, VariantWrite } from "@/types/api";
import { apiClient, listAll } from "./api";
import { isCustomerSession } from "./auth.service";
import { mapProduct } from "./mappers";
const payload = (data: Product | Omit<Product, "id" | "createdAt" | "updatedAt">): ProductWrite => ({
  name: data.name, type: data.type, sales_price: data.salesPrice, cost: data.costPrice,
  currency: data.currency || "USD", notes: data.description, is_active: data.status === "active" });
export const productService = {
  async getAll(): Promise<Product[]> {
    if (isCustomerSession()) return [];
    const products = await listAll<ProductResponse>("/products");
    return Promise.all(products.map(async product => mapProduct(product, await productService.getVariants(product.id))));
  },
  async getById(id: string) { return mapProduct((await apiClient.get<ProductResponse>(`/products/${id}`)).data, await productService.getVariants(id)); },
  async create(data: Omit<Product, "id" | "createdAt" | "updatedAt">) { return mapProduct((await apiClient.post<ProductResponse>("/products", payload(data))).data); },
  async update(id: string, updates: Partial<Product>) {
    const product = await productService.getById(id);
    return mapProduct((await apiClient.put<ProductResponse>(`/products/${id}`, payload({ ...product, ...updates }))).data, await productService.getVariants(id));
  },
  async delete(id: string) { await apiClient.delete(`/products/${id}`); return true; },
  getVariants: (id: string) => listAll<VariantResponse>(`/products/${id}/variants`),
  async saveVariant(productId: string, data: VariantWrite, variantId?: string) {
    return (await (variantId ? apiClient.put<VariantResponse>(`/products/${productId}/variants/${variantId}`, data)
      : apiClient.post<VariantResponse>(`/products/${productId}/variants`, data))).data;
  },
  async archiveVariant(id: string) { await apiClient.delete(`/variants/${id}`); },
};
