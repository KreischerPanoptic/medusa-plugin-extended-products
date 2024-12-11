import { 
    MedusaRequest, 
    MedusaResponse
} from "@medusajs/medusa"
import ExtenderService from "../../../../../services/extender";

export const GET = async (
    req: MedusaRequest,
    res: MedusaResponse
) => {
    const extenderService: ExtenderService = req.scope.resolve(
       "extenderService"
    )

    const {id} = req.params;
    
    const result = await extenderService.incrementViews(id)

      res.json({
        success: result? true: false,
        product: result
    })
}