import type { 
    WidgetConfig, 
    ProductDetailsWidgetProps,
  } from "@medusajs/admin"

import {
  adminProductKeys
} from "medusa-react";

import {Container} from '@medusajs/ui'
import ExtendedProductEditModal from "../components/extended-products/widgets/extended-product-edit-form"
import { useQueryClient } from "@tanstack/react-query";  

  const ExtendedProductWidget = ({
    product,
    notify,
  }: ProductDetailsWidgetProps) => {

    const queryClient = useQueryClient();

    const refresh = async () => {
      await queryClient.invalidateQueries(adminProductKeys.lists());
    };

    return (
      <Container className="bg-white p-8 border border-gray-200 rounded-lg">
        <h1>Додаткова інформація про продукт - {product.title}</h1>
        <ExtendedProductEditModal
          product={product}
          notify={notify}
          onSave={refresh}
        />
      </Container>
    )
  }
  
  export const config: WidgetConfig = {
    zone: "product.details.after",
  }
  
export default ExtendedProductWidget