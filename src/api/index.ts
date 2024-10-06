import { registerOverriddenValidators } from "@medusajs/medusa"
import { IsOptional, IsInt, IsArray, Min, MaxLength, ValidateNested, IsUrl } from "class-validator";
import { AdminPostProductsProductReq as MedusaAdminPostProductsProductReq } from "@medusajs/medusa";
import { ProductProperties } from "../requests/properties";

class AdminPostProductsProductReq extends MedusaAdminPostProductsProductReq {
    /*@IsArray()
    @IsUrl({
        require_host: true,
        require_valid_protocol: true,
        require_protocol: true,
        protocols: ['https'],
        host_whitelist: ['youtube.com', 'youtu.be', 'm.youtube.com']
    }, {
        each: true
    })
    @IsOptional()
    videos: string[];

    @IsArray()
    @ValidateNested({
        each: true
    })
    @IsOptional()
    properties: ProductProperties[];

    @IsInt()
    @Min(0)
    visits: number;*/
}

registerOverriddenValidators(AdminPostProductsProductReq)
