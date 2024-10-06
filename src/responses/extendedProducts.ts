import { PaginatedResponse, Product } from "@medusajs/medusa";
import { StoreExtendedProduct } from "./extendedProduct";

export type StoreExtendedProductsListRes = PaginatedResponse & {
    products: StoreExtendedProduct[];
};
