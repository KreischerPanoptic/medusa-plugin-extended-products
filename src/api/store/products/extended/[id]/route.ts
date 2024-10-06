import { 
    MedusaRequest, 
    MedusaResponse,
    StoreGetProductCategoriesParams,
    ProductService
} from "@medusajs/medusa"

export const GET = async (
    req: MedusaRequest<StoreGetProductCategoriesParams>,
    res: MedusaResponse
) => {
    // const categoriesService: ProductCategoryService = req.scope.resolve(
    //     "productCategoryService"
    //   )
      const {limit,offset,expand} = req.query;
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

    // const categoriesService: ProductCategoryService = req.scope.resolve(
    //    "productCategoryService"
    // )

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
        // count: results[1],
        limit: limit,
        offset: offset,
        // product_categories: categories
    })
}