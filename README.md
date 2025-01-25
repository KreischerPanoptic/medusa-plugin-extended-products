# medusa-plugin-extended-products
A Medusa.js plugin that extends default product functionality with additional features like popularity tracking, sorting, filtering, and advanced pagination. For now the only available language of UI is Ukrainian, but translations are in development.

[Medusa Website](https://medusajs.com/) | [Medusa Repository](https://github.com/medusajs/medusa)

## Features

- Extended product information (visits, orders, wishlists)
- Advanced sorting options (newest, popular, price)
- Smart pagination with available/unavailable products handling
- Category-based filtering
- Product popularity tracking
- Availability status tracking
- Support for product metadata (properties, videos)
- Performance-optimized querying
- Easy integration with existing Medusa stores
- Custom product properties management via Admin UI
- Rich text description editor with Markdown support
- Structured product information fields:

1. Nutritional values
2. Storage conditions
3. Product specifications
4. Country of origin
5. Packaging details
6. Warnings/Precautions
7. Special features

---

## Prerequisites

- [Medusa backend](https://docs.medusajs.com/development/backend/install)
- Medusa.js v1.x

---

## How to Install

1\. Run the following command in the directory of the Medusa backend:

```bash
yarn add medusa-plugin-extended-products
```

2\. In `medusa-config.js` add the following configuration:

```js
const plugins = [
  // ...
  {
    resolve: `medusa-plugin-extended-products`,
    options: {
      enableUI: true,
    },
  },
]
```

---

## Extended Product Model

The plugin extends the default Medusa Product model with additional fields:

```typescript
interface ExtendedProduct extends Partial<Product> {
  videos: string[];           // Array of video URLs
  properties: Property[];     // Custom product properties
  visits: number;            // View count
  orders: number;            // Number of orders
  wishlisted: number;        // Times added to wishlists
  popularity: number;        // Calculated popularity score
  state: 'available' | 'unavailable'; // Availability state
}
```

## REST API Endpoints

### Store Endpoints:

1. `/store/products/extended`:
- GET with query parameters:
  - `page`: Page number (default: 1)
  - `count`: Items per page (default: 20)
  - `sort`: Sorting type ('newest', 'popular', 'cheap', 'expensive')
  - `available`: Filter by availability ('true', 'false')
  - `categories`: Category handles, comma-separated
- Returns:
  ```typescript
  {
    products: ExtendedProduct[],
    metadata: {
      total: number,
      pages: number,
      page: number,
      count: number
    }
  }
  ```

2. `/store/products/extended/[id]/views`:
- POST: Increments view count for specific product
- Returns: Updated ExtendedProduct object

## Sorting Options

- `newest`: Products sorted by creation date
- `popular`: Products sorted by popularity score (visits * 0.15 + orders * 0.65 + wishlisted * 0.20)
- `cheap`: Products sorted by lowest variant price
- `expensive`: Products sorted by highest variant price

## Filtering

- By availability: Show only available or unavailable products
- By categories: Show products from specific categories (union of multiple categories)
- Combined filtering: Apply both filters simultaneously

## Pagination Features

- Smart handling of available/unavailable products
- Fills pages to requested count by adding unavailable products when needed
- Proper counting and page calculation for partial results

## Performance Considerations

The plugin implements several optimizations:
- Batch data loading
- Efficient filtering using Sets
- Optimized database queries
- Proper relation handling
- Memory-efficient data processing

## Usage Examples

```typescript
// Get first page of 20 most popular products
GET /store/products/extended?sort=popular&page=1&count=20

// Get cheap products from specific categories
GET /store/products/extended?sort=cheap&categories=dried-fruits,nuts

// Get only available products
GET /store/products/extended?available=true

// Increment product views
POST /store/products/extended/prod_123/views
```

---

## Homepage

- [Medusa Extended Products](https://github.com/KreischerPanoptic/medusa-plugin-extended-products)

---