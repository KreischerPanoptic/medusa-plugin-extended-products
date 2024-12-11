import { Product as MedusaProduct } from '@medusajs/medusa'
import {AfterLoad, Entity, OneToMany} from 'typeorm';
import {IsArray, IsOptional, IsUrl} from "class-validator";

@Entity()
export class Product extends MedusaProduct {
    @IsArray()
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

    // @AfterLoad()
    // getState() {
    //     this.status = 'https://domain.com' + this.employer.name + '.jpg';
    // }
}