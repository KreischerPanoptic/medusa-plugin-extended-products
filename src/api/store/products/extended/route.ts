import { 
    MedusaRequest, 
    MedusaResponse 
} from "@medusajs/medusa";
import ExtenderService, { 
    FilteringOptions, 
    DisplayOptions, 
    SortOptions 
} from "../../../../services/extender";

// Define valid sort types
type SortType = 'newest' | 'popular' | 'cheap' | 'expensive';

// Define expected query parameters
interface ProductsQueryParams {
    available?: string;
    sort?: string;
    page?: string;
    count?: string;
    categories?: string;
}

// Helper functions with proper typing
const parseSortType = (sort?: string): SortType | undefined => {
    const validSortTypes: SortType[] = ['newest', 'popular', 'cheap', 'expensive'];
    return validSortTypes.includes(sort as SortType) ? sort as SortType : undefined;
};

const parseBoolean = (value?: string): boolean | undefined => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
};

const parseNumber = (value?: string, defaultValue: number = 1): number => {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
};

const parseCategories = (categories?: string): string[] => {
    if (!categories || categories === 'undefined') return [];
    return categories
        .split(',')
        .map(category => category.trim())
        .filter(Boolean);
};

export const GET = async (
    req: MedusaRequest,
    res: MedusaResponse
) => {
    try {
        const {
            available,
            sort,
            page: pageParam,
            count: countParam,
            categories: categoriesParam
        } = req.query as ProductsQueryParams;

        // Parse and validate query parameters
        const filter: FilteringOptions = {
            available: parseBoolean(available),
            categoriesHandles: parseCategories(categoriesParam) // Updated to use handles instead of IDs
        };

        const display: DisplayOptions = {
            page: parseNumber(pageParam, 1),
            count: parseNumber(countParam, 20) // Added a more reasonable default
        };

        const sorting: SortOptions = {
            type: parseSortType(sort)
        };

        // Get service and fetch data
        const extenderService: ExtenderService = req.scope.resolve("extenderService");
        const { data, metadata } = await extenderService.paginateWithMetadata(
            filter, 
            sorting, 
            display
        );

        // Return response
        res.status(200).json({
            products: data,
            metadata: {
                ...metadata,
                page: display.page,
                count: display.count
            }
        });

    } catch (error) {
        // Proper error handling
        console.error('Products route error:', error);
        res.status(500).json({
            message: 'An error occurred while fetching products',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};