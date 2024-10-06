import { PricedProduct } from "@medusajs/medusa/dist/types/pricing";
import { ProductProperties } from "./properties";

export type StoreExtendedProduct = PricedProduct & {
    videos: string[];
    properties: ProductProperties[];
    visits: number;
};