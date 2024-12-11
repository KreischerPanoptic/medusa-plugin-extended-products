import {
    ConfigModule,
    MedusaContainer,
  } from "@medusajs/medusa"
import ExtenderService from "../services/extender"

  
  export default async (
    container: MedusaContainer,
    config: ConfigModule
  ): Promise<void> => {
    console.info("Starting extended products service loader...")
    const extenderService = container.resolve<ExtenderService>(
      "extenderService"
    )
    /*console.info(`Total products count: ${
      (await extenderService.paginateCounter({available: true, categoriesHandles: []}, 0)).total
    }`)*/
    console.info("Ending extended products service loader...")
  }