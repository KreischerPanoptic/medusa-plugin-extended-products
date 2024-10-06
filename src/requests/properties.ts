import { IsString, IsNotEmpty, IsOptional, IsInt, IsArray, Min, MinLength, MaxLength, ValidateNested, IsUrl } from "class-validator";

export class ProductProperties {
    @IsString()
    @IsNotEmpty()
    @MinLength(2)
    @MaxLength(50)
    key: string;

    @IsString()
    @IsOptional()
    @MinLength(0)
    @MaxLength(1024)
    value: string;
}