import { 
    MedusaRequest, 
    MedusaResponse,
    ProductService
} from "@medusajs/medusa"
import ExtenderService from "../../../../../services/extender";

export const GET = async (
    req: MedusaRequest,
    res: MedusaResponse
) => {
    const extenderService: ExtenderService = req.scope.resolve(
       "extenderService"
    )

    const productService: ProductService = req.scope.resolve(
        "productService"
     )

    const {id} = req.params;

    const product = await productService.retrieve(id);
    
    const result = await extenderService.enrich([product])

      res.json({
        product: result[0]
    })
}