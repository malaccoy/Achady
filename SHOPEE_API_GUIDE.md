# Shopee productOfferV2 API - Advanced Search and Filters

This document describes the new advanced search capabilities using Shopee's `productOfferV2` API endpoint.

## Overview

The bot now supports advanced product search using Shopee's category IDs and quality filters, in addition to the existing keyword-based search. This allows for more precise targeting of offers based on:

- Product categories
- Discount percentage
- Product ratings
- Sales volume
- Sort order preferences

## New Group Configuration Fields

Each WhatsApp group can now be configured with the following optional parameters:

### Category Search
- **Product Category IDs** (`productCatIds`): Array of Shopee category IDs
  - If provided, the bot will search within these categories
  - Uses the first category ID from the array
  - Can be combined with keywords for more precise results

### Sort Options
- **Sort Type** (`sortType`): How products are ordered (default: 2)
  - `1` = Relevance (RELEVANCE_DESC)
  - `2` = Most Sold (ITEM_SOLD_DESC) - **Default**
  - `3` = Highest Price (PRICE_DESC)
  - `4` = Lowest Price (PRICE_ASC)
  - `5` = Highest Commission (COMMISSION_DESC)

### Quality Filters
- **Minimum Discount** (`minDiscountPercent`): Filter products by minimum discount percentage (0-100)
- **Minimum Rating** (`minRating`): Filter products by minimum star rating (0.0-5.0)
- **Minimum Sales** (`minSales`): Filter products by minimum sales count

## How It Works

### Search Strategy

1. **Advanced Search (Category-Based)**
   - If `productCatIds` is configured with at least one category ID:
     - Uses `productOfferV2` API with category parameter
     - Optionally includes a keyword if configured
     - Applies configured sort type
     - Applies quality filters server-side
   
2. **Legacy Search (Keyword-Based)**
   - If `productCatIds` is empty or not configured:
     - Falls back to keyword-only search
     - Uses legacy behavior for backward compatibility
     - Still receives new API fields (priceDiscountRate, ratingStar, sales)

### Discount Calculation

The bot now uses the **real discount percentage** from Shopee's API:
- Field: `priceDiscountRate` (Int) - e.g., 25 = 25% off
- Used directly in message templates via `{{desconto}}` placeholder
- More accurate than previous estimated discount calculation

### API Response Fields

The `productOfferV2` API now returns these additional fields:
```javascript
{
  itemId: string,
  productName: string,
  imageUrl: string,
  price: number,
  priceMin: number,
  priceMax: number,
  offerLink: string,
  commissionRate: number,
  priceDiscountRate: number,  // NEW: Real discount % (10 = 10%)
  ratingStar: string,          // NEW: Rating (e.g., "4.7")
  sales: number                // NEW: Sales count
}
```

## Configuration via UI

### Group Settings Modal

In the Group Manager, click the settings (⚙️) icon on any group to access:

1. **Shopee Category IDs**
   - Add numeric category IDs from Shopee's catalog
   - Multiple IDs supported (uses first one)
   - Example: `12345`

2. **Sort Type**
   - Dropdown to select sort order
   - Defaults to "Most Sold" (best for popular products)

3. **Quality Filters**
   - Minimum Discount %: Filter low-discount items
   - Minimum Rating: Filter low-rated products
   - Minimum Sales: Filter unpopular items

## Example Configurations

### Example 1: High-Quality Kitchen Products
```javascript
{
  productCatIds: [12345],           // Kitchen category
  sortType: 2,                       // Most sold
  minDiscountPercent: 30,            // At least 30% off
  minRating: 4.5,                    // 4.5 stars or higher
  minSales: 100,                     // At least 100 sales
  keywords: ["panela", "cozinha"]    // Optional: additional filtering
}
```

### Example 2: Budget-Friendly Home Decor
```javascript
{
  productCatIds: [67890],           // Home decor category
  sortType: 4,                       // Lowest price
  minDiscountPercent: 20,            // At least 20% off
  keywords: ["decoração", "casa"]
}
```

### Example 3: Premium Beauty Products
```javascript
{
  productCatIds: [11111],           // Beauty category
  sortType: 5,                       // Highest commission
  minRating: 4.8,                    // Premium quality
  minSales: 500,                     // Well-established products
}
```

## Backward Compatibility

### Existing Groups
- Groups without `productCatIds` configured continue to work as before
- Uses keyword-only search with existing behavior
- No migration required

### Message Templates
- All existing templates continue to work
- `{{desconto}}` variable now shows real discount from API
- More accurate pricing information

## API Endpoints

### GET /api/groups
Returns groups with new fields:
```json
{
  "id": "abc123",
  "name": "Group Name",
  "productCatIds": [12345, 67890],
  "sortType": 2,
  "minDiscountPercent": 25,
  "minRating": 4.5,
  "minSales": 100,
  ...
}
```

### PUT /api/groups/:id
Update group configuration:
```json
{
  "productCatIds": [12345],
  "sortType": 2,
  "minDiscountPercent": 30,
  "minRating": 4.5,
  "minSales": 100
}
```

## Implementation Details

### Database Schema
New fields in `Group` model (Prisma):
```prisma
model Group {
  // ... existing fields
  productCatIds       String?  // JSON array: "[12345, 67890]"
  sortType            Int      @default(2)
  minDiscountPercent  Int?
  minRating           Float?
  minSales            Int?
}
```

### Helper Function
`searchOffersForGroup(shopee, group)` intelligently chooses between:
1. Advanced search (if `productCatIds` configured)
2. Legacy search (if not)

### Server-Side Filtering
Filters are applied after API call:
- Discount filter: `offer.priceDiscountRate >= minDiscountPercent`
- Rating filter: `parseFloat(offer.ratingStar) >= minRating`
- Sales filter: `offer.sales >= minSales`

## Testing

Run the test script to validate functionality:
```bash
# With Shopee credentials
SHOPEE_APP_ID=your_app_id SHOPEE_SECRET=your_secret node test-shopee-api.js

# Without credentials (structure validation only)
node test-shopee-api.js
```

## Troubleshooting

### No Offers Found
- Check if category ID is valid
- Lower quality filter thresholds
- Verify sort type is appropriate for category
- Try with keyword only first

### Filters Too Restrictive
- Start with no filters and gradually add
- Check logs for how many offers were filtered out
- Balance between quality and quantity

### API Errors
- Verify Shopee API credentials are valid
- Check if category IDs exist in Shopee's catalog
- Review error messages in logs (`/api/logs`)

## Best Practices

1. **Start Simple**: Begin with category ID only, add filters gradually
2. **Monitor Results**: Check logs to see how many offers pass filters
3. **Adjust Dynamically**: Lower thresholds if too few offers are found
4. **Test First**: Use the "Test" button before activating automation
5. **Category Research**: Research Shopee category IDs for your niche
6. **Balance Quality**: Don't set filters too high, or you'll get no results

## Future Enhancements

Potential improvements for future versions:
- Multiple category support (currently uses first ID only)
- Dynamic filter adjustment based on results
- Category ID lookup/search tool
- Filter presets for common niches
- A/B testing different configurations
