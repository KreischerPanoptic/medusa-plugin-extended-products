import { 
    MedusaRequest, 
    MedusaResponse
} from "@medusajs/medusa"
import ExtendedProductService, { FilteringOptions, DisplayOptions, SortOptions } from "../../../../services/extendedProducts";

function reTypeSort(sort: string | undefined): 'newest' | 'popular' | 'cheap' | 'expensive'| undefined {
    switch(sort) {
        case 'newest':
            return 'newest';
        case 'popular':
            return 'popular';
        case 'cheap':
            return 'cheap';
        case 'expensive':
            return 'expensive';
        default:
            return undefined;
    }
}

function reTypeAvailability(available: string | undefined): boolean | undefined {
    switch(available) {
        case 'true':
            return true;
        case 'false':
            return false;
        default:
            return undefined;
    }
}

export const GET = async (
    req: MedusaRequest,
    res: MedusaResponse
) => {
    // const categoriesService: ProductCategoryService = req.scope.resolve(
    //     "productCategoryService"
    //   )
    const available: boolean | undefined = reTypeAvailability(`${req.query.available}`);
    const sort: 'newest' | 'popular' | 'cheap' | 'expensive' | undefined = reTypeSort(`${req.query.sort}`)
    const page: number = req.query.page ? Number.isNaN(Number.parseInt(`${req.query.page}`)) ? 1 : Number.parseInt(`${req.query.page}`) : 1;
    const count: number = req.query.count ? Number.isNaN(Number.parseInt(`${req.query.count}`)) ? 1 : Number.parseInt(`${req.query.count}`) : 1;
    const categories: string[] = [];
    for(let category of `${req.query.categories}`.split(',')) {
        if(category && category !== 'undefined')
            categories.push(category)
    }
    
    //   const remoteQuery = req.scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)

    //   const queryObject = remoteQueryObjectFromString({
    //     entryPoint: "product_category",
    //     variables: {
    //       filters: req.filterableFields,
    //       ...req.remoteQueryConfig.pagination,
    //     },
    //     fields: req.remoteQueryConfig.fields,
    //   })
    
    //   let { metadata } = await remoteQuery(queryObject)

    const extendedProductService: ExtendedProductService = req.scope.resolve(
       "extendedProductService"
    )
    const filter: FilteringOptions = {
        available: available,
        categoriesIds: categories
    }
    const display: DisplayOptions = {
        page: page,
        count: count
    }
    const sorting: SortOptions = {
        type: sort
    }

    

    // let results = expand ? await categoriesService.listAndCount({}, {take: parseInt(`${limit || '10'}`), skip: parseInt(`${offset || '0'}`), relations: [ `${expand}` ]}) : await categoriesService.listAndCount({}, {take: parseInt(`${limit || '10'}`), skip: parseInt(`${offset || '0'}`)})
    // let categories = []
    // results[0].forEach(element => {
    //     categories.push({
    //         id: element.id,
    //         created_at: element.created_at,
    //         updated_at: element.updated_at,
    //         parent_category_id: element.parent_category_id,
    //         rank: element.rank,
    //         parent_category: element.parent_category,
    //         category_children: element.category_children,
    //         products: element.products,
    //         name: element?.name || '',
    //         description: element?.description || '',
    //         thumbnail: element?.metadata?.thumbnailImageUrl || '',
    //         visits: element?.metadata?.visitsCount || 0,
    //         handle: element?.handle || '',
    //         is_active: element?.is_active || false,
    //         is_internal: element?.is_internal || false,
    //         metadata: element.metadata,
    //     })
    // });

    // categories = categories.sort(function(a, b) {
    //     return b.visits - a.visits;
    // })
    //let results: [ProductCategory[],number] = await categoriesService.listAndCount({i})
      res.json({
        page: page ?? 1,
        count: count ?? 1,
        pages: await extendedProductService.paginateCounter(filter, count ?? 1),
        products: await extendedProductService.paginate(filter, sorting, display)
    })
}