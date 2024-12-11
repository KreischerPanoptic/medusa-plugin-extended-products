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
  LineItemService
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
    //TODO: orders not working, always zero
    /*private async enrich(products: Product[]): Promise<ExtendedProduct[]> {
      const orderRepo = this.activeManager_.withRepository(
        this.orderRepository_
      )
      const orders = await orderRepo.find();
    const customers = await this.customerRepository_.find();
      let extendies: ExtendedProduct[] = []
      for(const product of products) {
        let tmpState: {key: string, isAvailable: boolean}[] = []
        if(product.variants && product.variants.length > 0) {
          for(const variant of product.variants) {
            tmpState.push({
              key: variant.id,
              isAvailable: variant.inventory_quantity > 0
            })
          }
        }

        let ordersCount = 0;
        
        for(const order of orders) {
          try {
            const cart = await this.cartRepository_.findOne({
              where: { id: order.cart_id },
              relations: ['items']
            });
            
            // Debug logs
            console.log('Cart raw:', JSON.stringify(cart, null, 2));
            console.log('Cart items:', JSON.stringify(cart?.items?.map(item => ({
              id: item.id,
              product_id: item.product_id
            })), null, 2));
        
            if (cart?.items?.length > 0) {
              if (
                order.status !== OrderStatus.CANCELED && 
                cart.items.some((item) => item.product_id === product.id)
              ) {
                ordersCount += 1;
              }
            }
          } catch (error) {
            console.error(`Error processing order ${order.id}:`, error);
            continue;
          }
        }

        let wishlistedCount = 0;
        for(const customer of customers) {
          if(customer.metadata?.wishlist) {
            if((customer.metadata?.wishlist as any).some((wish) => {return wish.variant.product.id === product.id})) {
              wishlistedCount += 1;
            }
          }
        }
        if(product.metadata) {
          const visits = (product.metadata.visitsCount as number);
          const videos = (product.metadata.videoUrls as string);
          const properties = product.metadata.propertiesObj as string
          extendies.push({
            ...product,
            videos: videos && videos.length > 0 ? videos.split('|') : [],
            visits: isNaN(visits) ? 0 : visits,
            orders: ordersCount,
            wishlisted: wishlistedCount,
            popularity: (isNaN(visits) ? 0 : visits * 0.15) + (ordersCount * 0.65) + (wishlistedCount * 0.20),
            properties: properties && properties.length > 0 ? JSON.parse(properties) as ProductProperties[] : [],
            state: tmpState.every((s) => {return !s.isAvailable}) ? 'unavailable' : 'available'
          })
        }
        else {
          extendies.push({
            ...product,
            videos: [],
            visits: 0,
            orders: ordersCount,
            wishlisted: wishlistedCount,
            popularity: (ordersCount * 0.65) + (wishlistedCount * 0.20),
            properties: [],
            state: tmpState.every((s) => {return !s.isAvailable}) ? 'unavailable' : 'available'
          })
        }
      }
      return extendies;
    }*/

    private toUnixTimeStamp(date: Date): number {
      return Math.floor(date.getTime() / 1000)
    }

    private async enrich(products: Product[]): Promise<ExtendedProduct[]> {
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
          popularity: (visits * 0.15) + (ordersCount * 0.65) + (wishlistedCount * 0.20),
          properties,
          state: tmpState.every(s => !s.isAvailable) ? 'unavailable' : 'available'
        };
      });
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
    
      // Enrich and apply popularity sorting if needed
      const enriched = await this.enrich(result);
      
      if (sort.type === 'popular') {
        enriched.sort((a, b) => b.popularity - a.popularity);
      }
    
      return {
        data: enriched,
        metadata: {
          total,
          pages
        }
      };
    }
  
    /*async paginateCounter(filter: FilteringOptions, count?: number): Promise<PageMetadata> {
      const products = await this.productRespository_.find({
        select: ['id', 'variants'],
        relations: ['variants', 'categories']
      });
    
      let available: Product[] = [];
      let unavailable: Product[] = [];
    
      // If we're not filtering by availability, split into two arrays
      if (filter.available === undefined) {
        [available, unavailable] = products.reduce((acc, product) => {
          const hasAvailableVariant = product.variants.some(v => v.inventory_quantity > 0);
          acc[hasAvailableVariant ? 0 : 1].push(product);
          return acc;
        }, [[], []] as [Product[], Product[]]);
      } else {
        // If filtering by availability, we only need one array
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
      if (filter.categoriesIds?.length) {
        const categorySet = new Set(filter.categoriesIds);
        const filterByCategory = (product: Product) => 
          product.categories.some(category => categorySet.has(category.id));
        
        available = available.filter(filterByCategory);
        unavailable = unavailable.filter(filterByCategory);
      }
    
      const total = 
        filter.available === undefined ? 
          available.length + unavailable.length :
          filter.available ? available.length : unavailable.length;
    
      if (!count) {
        return { total };
      }
    
      // Calculate total pages considering the combined length
      let pages = 1;
      if (filter.available === undefined) {
        // Calculate how many full pages we can fill
        const totalProducts = available.length + unavailable.length;
        pages = Math.max(1, Math.ceil(totalProducts / count));
      } else {
        pages = Math.max(1, Math.ceil(total / count));
      }
    
      return {
        total,
        pages
      };
    }
    
    async paginate(filter: FilteringOptions, sort: SortOptions, display: DisplayOptions): Promise<ExtendedProduct[]> {
      const products = await this.productRespository_.find({
        relations: ['variants', 'variants.prices', 'variants.prices.currency', 'categories']
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
      if (filter.categoriesIds?.length) {
        const categorySet = new Set(filter.categoriesIds);
        const filterByCategory = (product: Product) => 
          product.categories.some(category => categorySet.has(category.id));
        
        available = available.filter(filterByCategory);
        unavailable = unavailable.filter(filterByCategory);
      }
    
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
    
      // Enrich and apply popularity sorting if needed
      const enriched = await this.enrich(result);
      
      if (sort.type === 'popular') {
        enriched.sort((a, b) => b.popularity - a.popularity);
      }
    
      return enriched;
    }*/
  
    private narrow(products: Product[]): {product: Product, price: number}[] {
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

    /*async paginate(filter: FilteringOptions, sort: SortOptions, display: DisplayOptions): Promise<ExtendedProduct[]> {
      const products = await this.productRespository_.find({
        relations: ['variants', 'variants.prices', 'categories']
      })

      let filtered: Product[] = []

      if(filter.categoriesIds) {
        if(filter.categoriesIds.length > 0) {
          filtered = await this.filterByCategories(products, filter.categoriesIds)
          filtered = await this.filterByAvailability(filtered, filter.available);
        }
        else {
          filtered = await this.filterByAvailability(products, filter.available);
        }
      }
      else {
        filtered = await this.filterByAvailability(products, filter.available);
      }
      

      if(filter.available === undefined || filter.available === null) {
        const splitted = await this.splitByAvailability(filtered);
        let available = splitted[0];
        let unavailable = splitted[1];
        switch(sort.type) {
          case 'cheap':
            let narrowedCheapAvailable = this.narrow(available);
            narrowedCheapAvailable = narrowedCheapAvailable.sort((a, b) => {
              return a.price - b.price
            })
            const resultsCheapAvailable = narrowedCheapAvailable.map((a) => {
              return a.product
            })

            let narrowedCheapUnavailable = this.narrow(unavailable);
            narrowedCheapUnavailable = narrowedCheapUnavailable.sort((a, b) => {
              return a.price - b.price
            })
            const resultsCheapUnavailable = narrowedCheapUnavailable.map((a) => {
              return a.product
            })
            return await this.reArange(resultsCheapAvailable, resultsCheapUnavailable, display, true)
          case 'expensive':
            let narrowedExpensiveAvailable = this.narrow(available);
            narrowedExpensiveAvailable = narrowedExpensiveAvailable.sort((a, b) => {
              return b.price - a.price
            })
            const resultsExpensiveAvailable = narrowedExpensiveAvailable.map((a) => {
              return a.product
            })

            let narrowedExpensiveUnavailable = this.narrow(unavailable);
            narrowedExpensiveUnavailable = narrowedExpensiveUnavailable.sort((a, b) => {
              return b.price - a.price
            })
            const resultsExpensiveUnavailable = narrowedExpensiveUnavailable.map((a) => {
              return a.product
            })
            return await this.reArange(resultsExpensiveAvailable, resultsExpensiveUnavailable, display, true)
          case 'newest':
            let availableNewest = available.sort((a, b) => {
              return this.toUnixTimeStamp(b.created_at) - this.toUnixTimeStamp(a.created_at)
            })
            let unavailableNewest = unavailable.sort((a, b) => {
              return this.toUnixTimeStamp(b.created_at) - this.toUnixTimeStamp(a.created_at)
            })
            return await this.reArange(availableNewest, unavailableNewest, display, true);
          case 'popular':
            let extendiesAvailablePopular = await this.enrich(available);
            extendiesAvailablePopular = extendiesAvailablePopular.sort((a,b) => {
              return b.popularity - a.popularity
            })
            let extendiesUnavailablePopular = await this.enrich(unavailable);
            extendiesUnavailablePopular = extendiesUnavailablePopular.sort((a,b) => {
              return b.popularity - a.popularity
            })
            return await this.reArange(extendiesAvailablePopular, extendiesUnavailablePopular, display);
          default:
            return await this.reArange(available, unavailable, display, true);
        }
      }
      else {
        switch(sort.type) {
          case 'cheap':
            let narrowedCheap = this.narrow(filtered);
            narrowedCheap = narrowedCheap.sort((a, b) => {
              return a.price - b.price
            })
            const resultsCheap = narrowedCheap.map((a) => {
              return a.product
            })
            const extendiesCheap = await this.enrich(resultsCheap);
            return extendiesCheap.slice((display.page > 0 ? display.page-1 : display.page)*display.count, ((display.page > 0 ? display.page-1 : display.page)*display.count) + display.count);
          case 'expensive':
            let narrowedExpensive = this.narrow(filtered);
            narrowedExpensive = narrowedExpensive.sort((a, b) => {
              return b.price - a.price
            })
            const resultsExpensive = narrowedExpensive.map((a) => {
              return a.product
            })
            const extendiesExpensive = await this.enrich(resultsExpensive);
            return extendiesExpensive.slice((display.page > 0 ? display.page-1 : display.page)*display.count, ((display.page > 0 ? display.page-1 : display.page)*display.count) + display.count);
          case 'newest':
            filtered = filtered.sort((a, b) => {
              return this.toUnixTimeStamp(b.created_at) - this.toUnixTimeStamp(a.created_at)
            })
            let extendiesNewest = await this.enrich(filtered);
            return extendiesNewest.slice((display.page > 0 ? display.page-1 : display.page)*display.count, ((display.page > 0 ? display.page-1 : display.page)*display.count) + display.count);
          case 'popular':
            let extendiesPopular = await this.enrich(filtered);
            extendiesPopular = extendiesPopular.sort((a,b) => {
              return b.popularity - a.popularity
            })
            return extendiesPopular.slice((display.page > 0 ? display.page-1 : display.page)*display.count, ((display.page > 0 ? display.page-1 : display.page)*display.count) + display.count);
          default:
            const extendiesDefault = await this.enrich(filtered);
            return extendiesDefault.slice((display.page > 0 ? display.page-1 : display.page)*display.count, ((display.page > 0 ? display.page-1 : display.page)*display.count) + display.count);
        }
      }
    }*/

    /*async paginateCounter(filter: FilteringOptions, count?: number): Promise<PageMetadata> {
      const products = await this.productRespository_.find({
        relations: ['variants', 'variants.prices', 'categories']
      })

      let filtered: Product[] = []


      if(filter.categoriesIds) {
        if(filter.categoriesIds.length > 0) {
          filtered = await this.filterByCategories(products, filter.categoriesIds)
          filtered = await this.filterByAvailability(filtered, filter.available);
        }
        else {
          filtered = await this.filterByAvailability(products, filter.available);
        }
      }
      else {
        filtered = await this.filterByAvailability(products, filter.available);
      }
      

      return count ? {
        total: filtered.length,
        pages: Math.round(filtered.length / count) <= 0 ? 1 : Math.round(filtered.length / count)
      } : {
        total: filtered.length
      }
    }*/

    private async reArange(available: Product[] | ExtendedProduct[], unavailable: Product[] | ExtendedProduct[], display: DisplayOptions, enrich: boolean = false): Promise<ExtendedProduct[]> {
      //.slice((display.page > 0 ? display.page-1 : display.page)*display.count, ((display.page > 0 ? display.page-1 : display.page)*display.count) + display.count);
      let results: (Product | ExtendedProduct)[] = available.slice((display.page > 0 ? display.page-1 : display.page)*display.count, ((display.page > 0 ? display.page-1 : display.page)*display.count) + display.count);
      if(results.length <= 0) {
        results = unavailable.slice((display.page > 0 ? display.page-1 : display.page)*display.count, ((display.page > 0 ? display.page-1 : display.page)*display.count) + display.count)//TODO: It's not correctly finding a page!
      }
      else if(results.length > 0 && results.length < display.count) {
        results = results.concat(unavailable.slice(0, display.count - results.length)) //TODO: Not concating correctly?
      }

      if(enrich) {
        results = await this.enrich(results as Product[]);
      }
      return results as ExtendedProduct[]
    }
//TODO: not working at all, always returns empty array
    /*private narrow(products: Product[]): {product: Product, price: number}[] {
      const variants: {product: Product, price: number}[] = [];
      for(const product of products) {
        if(product.variants?.length > 0) {
          const variantWithPrices = product.variants.find(v => 
            v.prices && 
            Array.isArray(v.prices) && 
            v.prices.length > 0 &&
            'amount' in v.prices[0]  // Make sure we can access the amount
          );
    
          if(variantWithPrices) {
            variants.push({
              product,
              price: variantWithPrices.prices[0].amount
            });
          }
        }
      }
      console.log('narrowed variants: ', variants)
      return variants;
    }*/

    private async splitByAvailability(products: Product[]): Promise<[Product[],Product[]]> {
      const available: Product[] = []
      const unavailable: Product[] = []

      for(let product of products) {
        if(product.variants.some((variant) => {return variant.inventory_quantity > 0})) {
          available.push(product)
        }
      }

      for(let product of products) {
        if(product.variants.some((variant) => {return variant.inventory_quantity <= 0})) {
          unavailable.push(product)
        }
      }

      return [available,unavailable]
    }

    private async filterByCategories(products: Product[], categoriesIds: string[]): Promise<Product[]> {
      const filtered: Product[] = []
      if(categoriesIds) {
        if(categoriesIds.length > 0) {
          for(const product of products) {
            if(product.categories.some((category) => {return categoriesIds.includes(category.id)})) {
              filtered.push(product)
            }
          }
        }
        else {
          return products;
        }
      }
      else {
        return products;
      }
      return filtered;
    }

    private async filterByAvailability(products: Product[], available?: boolean): Promise<Product[]> {
      const filtered: Product[] = []
      if(available === null || available === undefined)
        return products;
      if(available === true) {
        for(const product of products) {
          if(product.variants.some((variant) => {return variant.inventory_quantity > 0})) {
            filtered.push(product)
          }
        }
      }
      else if(available === false) {
        for(const product of products) {
          if(product.variants.some((variant) => {return variant.inventory_quantity <= 0})) {
            filtered.push(product)
          }
        }
      }
      return filtered;
    }
}

export default ExtenderService;
