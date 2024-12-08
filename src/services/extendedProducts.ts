/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable require-jsdoc */
import { Lifetime } from "awilix";
import { Logger } from "@medusajs/types";
import ProductRepository from "@medusajs/medusa/dist/repositories/product";
import { 
  ProductService,
  OrderService,
  UserService,
  CustomerService,
  Selector,
  FindConfig, 
  TransactionBaseService, 
  buildQuery,
  ProductCategory,
  Image,
  Product,
  OrderStatus,
} from "@medusajs/medusa"
import { MedusaError } from "@medusajs/utils"
import { ProductSelector, FindProductConfig } from "@medusajs/medusa/dist/types/product";
import { ProductProperties } from "../responses/properties";
import { fileURLToPath } from "url";

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
  categoriesIds: string[];
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

//export type CountOptions

class ExtendedProductService extends TransactionBaseService {
  static LIFE_TIME = Lifetime.SCOPED
  protected customerService: CustomerService;
  protected productService: ProductService;
  protected userService: UserService;
  protected orderService: OrderService;
  protected cartService: any;
  protected lineItemService: any;
  protected logger: Logger;

  constructor(container: any) {
      super(container);

      this.logger = container.logger;
      this.logger.info("✔ Extended products service initialized");
      this.productService = container.productService;
      this.customerService = container.customerService;
      this.userService = container.userService;
      this.orderService = container.orderService;
      this.cartService = container.cartService;
      this.lineItemService = container.lineItemService;
  }

    private async enrich(products: Product[]): Promise<ExtendedProduct[]> {
      const orders = await this.orderService.list({}, {
        relations: [
            "refunds",
            "items",
            "customer",
            "billing_address",
            "shipping_address",
            "discounts",
            "discounts.rule",
            "shipping_methods",
            "shipping_methods.shipping_option",
            "payments",
            "fulfillments",
            "fulfillments.tracking_links",
            "returns",
            "gift_cards",
            "gift_card_transactions",
            'variants',
            'categories',

        ]
    });

    const customers = await this.customerService.list();

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
          if(order.status === OrderStatus.COMPLETED && order.items.some((item) => {return item.product_id === product.id})) {
            ordersCount += 1;
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

        extendies.push({
          ...product,
          videos: (product.metadata.videoUrls as string).split('|'),
          visits: (product.metadata.visitsCount as number),
          orders: ordersCount,
          wishlisted: wishlistedCount,
          popularity: ((product.metadata.visitsCount as number) * 0.15) + (ordersCount * 0.65) + (wishlistedCount * 0.20),
          properties: JSON.parse(product.metadata.propertiesObj as string) as ProductProperties[],
          state: tmpState.every((s) => {return !s.isAvailable}) ? 'unavailable' : 'available'
        })
      }
      return extendies;
    }

    private toUnixTimeStamp(date: Date): number {
      return Math.floor(date.getTime() / 1000)
    }

    async listExtended(selector: ProductSelector, config?: FindProductConfig): Promise<ExtendedProduct[]> {
      if(!config.relations.includes('variants')) {
        config.relations.push('variants')
      }
      const products = await this.productService.list(selector, config)
      return await this.enrich(products);
    }

    async paginate(filter: FilteringOptions, sort: SortOptions, display: DisplayOptions): Promise<ExtendedProduct[]> {
      const config: FindProductConfig = {
      }
      const selector: ProductSelector = {
      }
      if(!config.relations.includes('variants')) {
        config.relations.push('variants')
      }
      if(!config.relations.includes('categories')) {
        config.relations.push('categories')
      }
      const products = await this.productService.list(selector, config)

      let filtered: Product[] = []

      if(filter.categoriesIds) {
        if(filter.categoriesIds.length > 0) {
          filtered = await this.filterByCategories(products, filter.categoriesIds)
        }
      }
      filtered = await this.filterByAvailability(filtered, filter.available);

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
    }

    async paginateCounter(filter: FilteringOptions, count?: number): Promise<PageMetadata> {
      const config: FindProductConfig = {
      }
      const selector: ProductSelector = {
      }
      if(!config.relations.includes('variants')) {
        config.relations.push('variants')
      }
      if(!config.relations.includes('categories')) {
        config.relations.push('categories')
      }
      const products = await this.productService.list(selector, config)

      let filtered: Product[] = []

      if(filter.categoriesIds) {
        if(filter.categoriesIds.length > 0) {
          filtered = await this.filterByCategories(products, filter.categoriesIds)
        }
      }
      filtered = await this.filterByAvailability(filtered, filter.available);

      return count ? {
        total: filtered.length,
        pages: Math.round(filtered.length / count) <= 0 ? 1 : Math.round(filtered.length / count)
      } : {
        total: filtered.length
      }
    }

    private async reArange(available: Product[] | ExtendedProduct[], unavailable: Product[] | ExtendedProduct[], display: DisplayOptions, enrich: boolean = false): Promise<ExtendedProduct[]> {
      //.slice((display.page > 0 ? display.page-1 : display.page)*display.count, ((display.page > 0 ? display.page-1 : display.page)*display.count) + display.count);
      let results: (Product | ExtendedProduct)[] = available.slice((display.page > 0 ? display.page-1 : display.page)*display.count, ((display.page > 0 ? display.page-1 : display.page)*display.count) + display.count);
      if(results.length <= 0) {
        results = unavailable.slice((display.page > 0 ? display.page-1 : display.page)*display.count, ((display.page > 0 ? display.page-1 : display.page)*display.count) + display.count)
      }
      else if(results.length > 0 && results.length < display.count) {
        results = results.concat(unavailable.slice(0, display.count - results.length))
      }

      if(enrich) {
        results = await this.enrich(results as Product[]);
      }
      return results as ExtendedProduct[]
    }

    private narrow(products: Product[]): {product: Product, price: number}[] {
      const variants: {product: Product, price: number}[] = [];
      for(const product of products) {
        if(product.variants.length > 0) {
          if(product.variants.every((v) => {return v.prices.length > 0})) {
            const sortedVariants = product.variants.sort((a, b) => {
              return a.prices[0].amount - b.prices[0].amount
            })
            variants.push({
              product,
              price: sortedVariants[0].prices[0].amount
            })
          }
        }
      }

      return variants;
    }

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
      }
      return filtered.length > 0 ? filtered : products;
    }

    private async filterByAvailability(products: Product[], available?: boolean): Promise<Product[]> {
      const filtered: Product[] = []
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
      return filtered.length > 0 ? filtered : products;
    }


//     async count(selector?: Selector<Product>): Promise<number> {
//         const bannerRepo = this.activeManager_.withRepository(
//             this.bannerRepository_
//           )
//           return await bannerRepo.count()
//     }

//     async listAndCount(
//         selector?: Selector<Banner>,
//         config: FindConfig<Banner> = {
//           skip: 0,
//           take: 20,
//           relations: [],
//       }): Promise<[ExtendedBanner[], number]> {
//         const bannerRepo = this.activeManager_.withRepository(
//           this.bannerRepository_
//         )
    
//         const query = buildQuery(selector, config)
    
//         let results = await bannerRepo.findAndCount(query)

//         const categoryRepo = this.activeManager_.withRepository(
//             this.categoryRepository_
//           )
//           const productRepo = this.activeManager_.withRepository(
//             this.productRepository_
//           )

//         let bannersResult: ExtendedBanner[] = [];
//         if(results[1] > 0) {
//           for(let banner of results[0]) {
//               let tmpBanner: ExtendedBanner = new ExtendedBanner();
//               tmpBanner.categoryId = banner.categoryId;
//               tmpBanner.created_at = banner.created_at;
//               tmpBanner.deleted_at = banner.deleted_at;
//               tmpBanner.id = banner.id;
//               tmpBanner.thumbnail = banner.thumbnail;
//               tmpBanner.link = banner.link;
//               tmpBanner.productId = banner.productId;
//               tmpBanner.rank = banner.rank;
//               tmpBanner.type = banner.type;
//               tmpBanner.updated_at = banner.updated_at;
//               if(banner.type === BannerType.CATEGORY) {
//                   const query = buildQuery({
//                       id: banner.categoryId,
//                     })
//                     let category = await categoryRepo.findOne(query);
//                   tmpBanner.category = category ? category : {}
//               }
//               else if(banner.type == BannerType.PRODUCT) {
//                   const query = buildQuery({
//                       id: banner.productId,
//                     })
//                     let product = await productRepo.findOne(query);
//                   tmpBanner.product = product ? product : {}
//               }
//               tmpBanner.thumbnail = banner.thumbnail;
//               bannersResult.push(tmpBanner)
//           }
//         }
//         return [bannersResult,results[1]]
//       }

//       async retrieve(
//         id: string,
//         config?: FindConfig<Banner>
//       ): Promise<ExtendedBanner> {
//         const bannerRepo = this.activeManager_.withRepository(
//             this.bannerRepository_
//           )
    
//         const query = buildQuery({
//           id,
//         }, config)
    
//         const banner = await bannerRepo.findOne(query)
    
//         if (!banner) {
//           throw new MedusaError(
//             MedusaError.Types.NOT_FOUND,
//             "Banner was not found"
//           )
//         }

//         const categoryRepo = this.activeManager_.withRepository(
//             this.categoryRepository_
//           )
//           const productRepo = this.activeManager_.withRepository(
//             this.productRepository_
//           )
//           const imageRepo = this.activeManager_.withRepository(
//             this.imageRepository_
//           )

//           let tmpBanner: ExtendedBanner = new ExtendedBanner();
//           tmpBanner.categoryId = banner.categoryId;
//           tmpBanner.created_at = banner.created_at;
//           tmpBanner.deleted_at = banner.deleted_at;
//           tmpBanner.id = banner.id;
//           tmpBanner.thumbnail = banner.thumbnail;
//           tmpBanner.link = banner.link;
//           tmpBanner.productId = banner.productId;
//           tmpBanner.rank = banner.rank;
//           tmpBanner.type = banner.type;
//           tmpBanner.updated_at = banner.updated_at;
//           if(banner.type === BannerType.CATEGORY) {
//               const query = buildQuery({
//                   id: banner.categoryId,
//                 })
//                 let category = await categoryRepo.findOne(query);
//               tmpBanner.category = category ? category : {}
//           }
//           else if(banner.type == BannerType.PRODUCT) {
//               const query = buildQuery({
//                   id: banner.productId,
//                 })
//                 let product = await productRepo.findOne(query);
//               tmpBanner.product = product ? product : {}
//           }
//           tmpBanner.thumbnail = banner.thumbnail
    
//         return tmpBanner
//       }

//       async create(
//         data: Pick<Banner, "type" | "rank" | 'categoryId' | 'thumbnail' | 'link' | 'productId'>
//       ): Promise<ExtendedBanner> {
//         return this.atomicPhase_(async (manager) => {
//             const bannerRepo = this.activeManager_.withRepository(
//                 this.bannerRepository_
//               )
//               const bannerSettingsRepo = this.activeManager_.withRepository(
//                 this.bannerSettingsRepository_
//               )
//               const settingsResult = await bannerSettingsRepo.find()
//               const bannerSettings = settingsResult[0]
    
//         if (!bannerSettings) {
//           throw new MedusaError(
//             MedusaError.Types.NOT_FOUND,
//             "Banner settings was not found"
//           )
//         }

//               /////////////////

//           const bannersCount = await this.count()
//           if(bannerSettings.max <= bannersCount) {
//             throw new MedusaError(
//                 MedusaError.Types.NOT_ALLOWED,
//                 "Max banners count - reached! Creation of new banners - prohibited."
//               )
//           }

//           const banner = bannerRepo.create()
//           banner.type = data.type;
//           banner.rank = data.rank;
//           banner.link = data.link;
//           banner.thumbnail = data.thumbnail;

//           const categoryRepo = this.activeManager_.withRepository(
//             this.categoryRepository_
//           )
//           const productRepo = this.activeManager_.withRepository(
//             this.productRepository_
//           )
//           const imageRepo = this.activeManager_.withRepository(
//             this.imageRepository_
//           )
// /////////////////////
//           if(data.categoryId) {
//             const categoryCheckQuery = buildQuery({
//                 id: data.categoryId,
//             })
//             let checkCategory = await categoryRepo.findOne(categoryCheckQuery);

//             if (!checkCategory) {
//                 throw new MedusaError(
//                 MedusaError.Types.NOT_FOUND,
//                 `Category with ID - ${data.categoryId} was not found`
//                 )
//             }
//             else {
//                 banner.categoryId = checkCategory.id;
//             }
//           }

//           if(data.productId) {
//             const productCheckQuery = buildQuery({
//                 id: data.productId,
//             })
//             let checkProduct = await productRepo.findOne(productCheckQuery);

//             if (!checkProduct) {
//                 throw new MedusaError(
//                 MedusaError.Types.NOT_FOUND,
//                 `Product with ID - ${data.productId} was not found`
//                 )
//             }
//             else {
//                 banner.productId = checkProduct.id;
//             }
//           }
          
// /////////////////////
//           const result = await bannerRepo.save(banner)

//           let tmpBanner: ExtendedBanner = new ExtendedBanner();
//           tmpBanner.categoryId = result.categoryId;
//           tmpBanner.created_at = result.created_at;
//           tmpBanner.deleted_at = result.deleted_at;
//           tmpBanner.id = result.id;
//           tmpBanner.thumbnail = result.thumbnail;
//           tmpBanner.link = result.link;
//           tmpBanner.productId = result.productId;
//           tmpBanner.rank = result.rank;
//           tmpBanner.type = result.type;
//           tmpBanner.updated_at = result.updated_at;
//           if(result.type === BannerType.CATEGORY) {
//               const query = buildQuery({
//                   id: result.categoryId,
//                 })
//                 let category = await categoryRepo.findOne(query);
//               tmpBanner.category = category ? category : {}
//           }
//           else if(result.type == BannerType.PRODUCT) {
//               const query = buildQuery({
//                   id: result.productId,
//                 })
//                 let product = await productRepo.findOne(query);
//               tmpBanner.product = product ? product : {}
//           }
//           tmpBanner.thumbnail = banner.thumbnail
//             return tmpBanner
//         })
//       }
    
//       async update(
//         id: string,
//         data: Omit<Partial<Banner>, "id">
//       ): Promise<ExtendedBanner> {
//         return await this.atomicPhase_(async (manager) => {
//             const bannerRepo = this.activeManager_.withRepository(
//                 this.bannerRepository_
//               )
//           const banner = await this.retrieve(id)

//           const categoryRepo = this.activeManager_.withRepository(
//             this.categoryRepository_
//           )
//           const productRepo = this.activeManager_.withRepository(
//             this.productRepository_
//           )
//           const imageRepo = this.activeManager_.withRepository(
//             this.imageRepository_
//           )
// /////////////////////
//           if(data.categoryId) {
//             const categoryCheckQuery = buildQuery({
//                 id: data.categoryId,
//             })
//             let checkCategory = await categoryRepo.findOne(categoryCheckQuery);

//             if (!checkCategory) {
//                 throw new MedusaError(
//                 MedusaError.Types.NOT_FOUND,
//                 `Category with ID - ${data.categoryId} was not found`
//                 )
//             }
//           }

//           if(data.productId) {
//             const productCheckQuery = buildQuery({
//                 id: data.productId,
//             })
//             let checkProduct = await productRepo.findOne(productCheckQuery);

//             if (!checkProduct) {
//                 throw new MedusaError(
//                 MedusaError.Types.NOT_FOUND,
//                 `Product with ID - ${data.productId} was not found`
//                 )
//             }
//           }
          
// /////////////////////

//           Object.assign(banner, data)
    
//           const result = await bannerRepo.save(banner)
//           let tmpBanner: ExtendedBanner = new ExtendedBanner();
//           tmpBanner.categoryId = result.categoryId;
//           tmpBanner.created_at = result.created_at;
//           tmpBanner.deleted_at = result.deleted_at;
//           tmpBanner.id = result.id;
//           tmpBanner.thumbnail = result.thumbnail;
//           tmpBanner.link = result.link;
//           tmpBanner.productId = result.productId;
//           tmpBanner.rank = result.rank;
//           tmpBanner.type = result.type;
//           tmpBanner.updated_at = result.updated_at;
//           if(result.type === BannerType.CATEGORY) {
//               const query = buildQuery({
//                   id: result.categoryId,
//                 })
//                 let category = await categoryRepo.findOne(query);
//               tmpBanner.category = category ? category : {}
//           }
//           else if(result.type == BannerType.PRODUCT) {
//               const query = buildQuery({
//                   id: result.productId,
//                 })
//                 let product = await productRepo.findOne(query);
//               tmpBanner.product = product ? product : {}
//           }
//           tmpBanner.thumbnail = banner.thumbnail
    
//             return tmpBanner
//         })
//       }
    
//       async delete(id: string): Promise<void> {
//         return await this.atomicPhase_(async (manager) => {
//             const bannerRepo = this.activeManager_.withRepository(
//                 this.bannerRepository_
//               )
//           const banner = await this.retrieve(id)
          
//           await bannerRepo.remove([banner])
//         })
//       }
}

export default ExtendedProductService;
