/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable require-jsdoc */
import { Lifetime } from "awilix";
import { Logger } from "@medusajs/types";
import ProductRepository from "@medusajs/medusa/dist/repositories/product";
import {
  OrderService,
  UserService,
  ProductService,
  CustomerService,
  Selector,
  FindConfig,
  TransactionBaseService,
  buildQuery,
  ProductCategory,
  Image,
  Product,
  OrderStatus,
  CartService,
  LineItemService,
  ProductStatus
} from "@medusajs/medusa"
import { ProductSelector, FindProductConfig } from "@medusajs/medusa/dist/types/product";
import { ProductProperties } from "../responses/properties";
import OrderRepository from "@medusajs/medusa/dist/repositories/order";
import CustomerRepository from "@medusajs/medusa/dist/repositories/customer";
import CartRepository from "@medusajs/medusa/dist/repositories/cart";
import PriceListRepository from "@medusajs/medusa/dist/repositories/price-list";
import LineItemRepository from "@medusajs/medusa/dist/repositories/line-item";
import { Not } from "typeorm";

export type ExtendedProduct = Partial<Product> & {
  videos: string[];
  properties: ProductProperties[];
  visits: number;
  orders: number;
  wishlisted: number;
  popularity: number;
  state: 'available' | 'unavailable'
};

export type FilteringOptions = {
  categoriesHandles: string[];
  available?: boolean;
}

export type SortOptions = {
  type?: 'newest' | 'popular' | 'cheap' | 'expensive'
}

export type DisplayOptions = {
  page: number;
  count: number;
}

export type PageMetadata = {
  total: number;
  pages?: number;
}

type PaginationResult = {
  data: ExtendedProduct[];
  metadata: PageMetadata;
}

//export type CountOptions

class ExtenderService extends TransactionBaseService {
  static LIFE_TIME = Lifetime.SCOPED

  protected productRespository_: typeof ProductRepository;
  protected orderRepository_: typeof OrderRepository;
  protected customerRepository_: typeof CustomerRepository;
  protected logger: Logger;

  constructor(container) {
    super(container);

    this.logger = container.logger;
    this.logger.info("✔ Extended products service initialized");
    this.orderRepository_ = container.orderRepository;
    this.productRespository_ = container.productRepository;
    this.customerRepository_ = container.customerRepository;
  }

  async incrementViews(id: string): Promise<ExtendedProduct | null> {
    try {
      // Input validation
      if (!id?.trim()) {
        return null;
      }

      // Find product with proper relations for enrichment
      const product = await this.productRespository_.findOne({
        where: { id },
        relations: ['variants', 'variants.prices', 'categories']
      });

      if (!product) {
        return null;
      }

      // Ensure metadata exists and is an object
      const metadata = product.metadata || {};

      // Safely get current visit count
      const currentVisits = typeof metadata.visitsCount === 'number'
        ? metadata.visitsCount
        : Number(metadata.visitsCount);

      // Update metadata with new visit count
      const updatedMetadata = {
        ...metadata,
        visitsCount: isNaN(currentVisits) ? 1 : currentVisits + 1
      };

      // Update product in database
      const updateResult = await this.productRespository_.update(
        { id },
        { metadata: updatedMetadata }
      );

      // Check if update was successful
      if (updateResult.affected !== 1) {
        throw new Error(`Failed to update visit count for product ${id}`);
      }

      // Update local product object
      product.metadata = updatedMetadata;

      // Enrich and return the updated product
      const enriched = await this.enrich([product]);
      return enriched[0] || null;

    } catch (error) {
      // Log the error for debugging
      console.error(`Error incrementing views for product ${id}:`, error);

      // You might want to throw this error depending on your error handling strategy
      // For now, we'll return null to maintain the existing behavior
      return null;
    }
  }

  async enrich(products: Product[]): Promise<ExtendedProduct[]> {
    // Batch fetch all orders and customers at once with proper relations
    const [orders, customers] = await Promise.all([
      this.orderRepository_.find({
        relations: ['items', 'items.variant', 'items.variant.product'], // Changed from cart relations
        where: {
          status: Not(OrderStatus.CANCELED) // Only non-canceled orders
        }
      }),
      this.customerRepository_.find()
    ]);

    // Create a Map for faster product lookup
    const productOrders = new Map<string, number>();

    // Process all orders at once
    for (const order of orders) {
      if (!order.items) continue;

      for (const item of order.items) {
        if (item.variant?.product_id) { // Using variant's product_id
          const currentCount = productOrders.get(item.variant.product_id) || 0;
          productOrders.set(item.variant.product_id, currentCount + 1);
        }
      }
    }

    // Create a Map for wishlisted counts
    const wishlistedCounts = new Map<string, number>();
    for (const customer of customers) {
      const wishlist = customer.metadata?.wishlist as any[] || [];
      for (const wish of wishlist) {
        const productId = wish.variant?.product?.id;
        if (productId) {
          const currentCount = wishlistedCounts.get(productId) || 0;
          wishlistedCounts.set(productId, currentCount + 1);
        }
      }
    }

    // Process all products at once
    return products.map(product => {
      const tmpState = product.variants?.map(variant => ({
        key: variant.id,
        isAvailable: variant.inventory_quantity > 0
      })) || [];

      const visits = Number(product.metadata?.visitsCount) || 0;
      const ordersCount = productOrders.get(product.id) || 0;
      const wishlistedCount = wishlistedCounts.get(product.id) || 0;

      const videos = (product.metadata?.videoUrls as string || '').split('|').filter(Boolean);
      const properties = product.metadata?.propertiesObj ?
        JSON.parse(product.metadata.propertiesObj as string) :
        [];

      return {
        ...product,
        videos,
        visits,
        orders: ordersCount,
        wishlisted: wishlistedCount,
        popularity: ordersCount,//(visits * 0.15) + (ordersCount * 0.65) + (wishlistedCount * 0.20),
        properties,
        state: tmpState.every(s => !s.isAvailable) ? 'unavailable' : 'available'
      };
    });
  }

  private async getProductOrderCounts(): Promise<Map<string, number>> {
    const orders = await this.orderRepository_.find({
      relations: ['items', 'items.variant', 'items.variant.product'],
      where: {
        status: Not(OrderStatus.CANCELED)
      },
      select: {
        id: true,
        items: {
          id: true,
          variant: {
            id: true,
            product_id: true
          }
        }
      }
    });

    const productOrders = new Map<string, number>();
    
    for (const order of orders) {
      if (!order.items) continue;
      
      for (const item of order.items) {
        if (item.variant?.product_id) {
          const currentCount = productOrders.get(item.variant.product_id) || 0;
          productOrders.set(item.variant.product_id, currentCount + 1);
        }
      }
    }

    return productOrders;
  }

  async paginateWithMetadata(
    filter: FilteringOptions,
    sort: SortOptions,
    display: DisplayOptions
  ): Promise<PaginationResult> {
    const products = await this.productRespository_.find({
      relations: [
        'variants',
        'variants.prices',
        'variants.prices.currency',
        'categories'
      ],
      where: {
        status: ProductStatus.PUBLISHED
      },
      // Add this to ensure we get all category fields
      select: {
        categories: {
          id: true,
          handle: true
        }
      }
    });

    let available: Product[] = [];
    let unavailable: Product[] = [];

    // Split products if not filtering by availability
    if (filter.available === undefined) {
      [available, unavailable] = products.reduce((acc, product) => {
        const hasAvailableVariant = product.variants.some(v => v.inventory_quantity > 0);
        acc[hasAvailableVariant ? 0 : 1].push(product);
        return acc;
      }, [[], []] as [Product[], Product[]]);
    } else {
      const filtered = products.filter(product =>
        product.variants.some(variant =>
          filter.available ?
            variant.inventory_quantity > 0 :
            variant.inventory_quantity <= 0
        )
      );
      if (filter.available) {
        available = filtered;
      } else {
        unavailable = filtered;
      }
    }

    // Apply category filtering if needed
    if (filter.categoriesHandles?.length) {
      const filterByCategory = (product: Product) =>
        // Check if product belongs to ANY of the requested categories (union)
        product.categories.some(category =>
          filter.categoriesHandles.includes(category.handle)
        );

      available = available.filter(filterByCategory);
      unavailable = unavailable.filter(filterByCategory);
    }

    // Calculate total and pages for metadata
    const total = filter.available === undefined ?
      available.length + unavailable.length :
      filter.available ? available.length : unavailable.length;

    const pages = Math.max(1, Math.ceil(total / display.count));

    // if (sort.type === 'popular') {
    //   // Determine which set of products we need to enrich
    //   let productsToEnrich: Product[] = [];
    //   if (filter.available === undefined) {
    //     productsToEnrich = [...available, ...unavailable];
    //   } else {
    //     productsToEnrich = filter.available ? available : unavailable;
    //   }

    //   // Enrich all relevant products at once
    //   const enriched = await this.enrich(productsToEnrich);
      
    //   // Sort by popularity
    //   enriched.sort((a, b) => b.popularity - a.popularity);

    //   // Apply pagination after sorting
    //   const startIndex = (Math.max(0, display.page - 1)) * display.count;
    //   const paginatedResults = enriched.slice(startIndex, startIndex + display.count);

    //   return {
    //     data: paginatedResults,
    //     metadata: { total, pages }
    //   };
    // }

    // Apply sorting to both arrays
    if (sort.type === 'cheap' || sort.type === 'expensive') {
      const sortByPrice = (products: Product[]) => {
        const narrowed = this.narrow(products);
        narrowed.sort((a, b) =>
          sort.type === 'cheap' ?
            a.price - b.price :
            b.price - a.price
        );
        return narrowed.map(n => n.product);
      };

      available = sortByPrice(available);
      unavailable = sortByPrice(unavailable);
    } else if (sort.type === 'newest') {
      const sortByDate = (a: Product, b: Product) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

      available.sort(sortByDate);
      unavailable.sort(sortByDate);
    } else if (sort.type === 'popular') {
      // Get order counts for all products
      const orderCounts = await this.getProductOrderCounts();
      
      available.sort((a, b) => {
        const countA = orderCounts.get(a.id) || 0;
        const countB = orderCounts.get(b.id) || 0;
        return countB - countA;
      });
      unavailable.sort((a, b) => {
        const countA = orderCounts.get(a.id) || 0;
        const countB = orderCounts.get(b.id) || 0;
        return countB - countA;
      });
    }

    // Calculate pagination
    const startIndex = (Math.max(0, display.page - 1)) * display.count;
    let result: Product[] = [];

    if (filter.available === undefined) {
      // Get items from available array
      const availableItems = available.slice(startIndex, startIndex + display.count);

      if (availableItems.length < display.count) {
        // Calculate how many unavailable items we need
        const remainingCount = display.count - availableItems.length;

        // Calculate offset for unavailable items based on how many available items we've used
        const unavailableStartIndex = Math.max(0, startIndex - available.length);
        const unavailableItems = unavailable.slice(unavailableStartIndex, unavailableStartIndex + remainingCount);

        result = [...availableItems, ...unavailableItems];
      } else {
        result = availableItems;
      }
    } else {
      result = filter.available ?
        available.slice(startIndex, startIndex + display.count) :
        unavailable.slice(startIndex, startIndex + display.count);
    }

    // Enrich only the paginated results for non-popularity sorts
    const enriched = await this.enrich(result);

    return {
      data: enriched,
      metadata: { total, pages }
    };
  }

  private narrow(products: Product[]): { product: Product, price: number }[] {
    return products
      .filter(product => product.variants?.length > 0)
      .map(product => {
        const variantWithLowestPrice = product.variants
          .filter(v => v.prices?.length > 0)
          .sort((a, b) => a.prices[0].amount - b.prices[0].amount)[0];

        return variantWithLowestPrice ? {
          product,
          price: variantWithLowestPrice.prices[0].amount
        } : null;
      })
      .filter(Boolean);
  }
}

export default ExtenderService;
