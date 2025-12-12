# Shopee Categories Configuration

This directory contains the configuration and helper functions for resolving Shopee category names to numeric IDs.

## Files

- `shopeeCategories.js` - CommonJS version for Node.js backend
- `shopeeCategories.ts` - TypeScript version for type safety

## Usage

### In Backend (Node.js)

```javascript
const { resolveShopeeCategoryId } = require('./src/config/shopeeCategories.js');

// Resolve numeric ID (passes through)
resolveShopeeCategoryId('100104'); // returns 100104

// Resolve category name
resolveShopeeCategoryId('Roupas Femininas'); // returns 100104
resolveShopeeCategoryId('roupas femininas'); // returns 100104 (case insensitive)
resolveShopeeCategoryId('Casa & Decoração'); // returns 100113

// Invalid input returns null
resolveShopeeCategoryId('Invalid Category'); // returns null
```

### Category Preset Map

The `CATEGORY_PRESETS_BR` object contains mappings from normalized category keys to Shopee LEVEL 1 category IDs. Keys are:
- Lowercase
- Without accents/diacritics
- Spaces and symbols replaced with underscores
- Trimmed of leading/trailing underscores

Example mappings:
```javascript
{
  'roupas_femininas': 100104,
  'beleza': 100109,
  'casa_decoracao': 100113,
  'pet_shop': 100118,
  // ...
}
```

### Normalization Function

The `normalizeCategoryKey()` function converts user input to normalized keys:

```javascript
normalizeCategoryKey('Roupas Femininas'); // 'roupas_femininas'
normalizeCategoryKey('Casa & Decoração'); // 'casa_decoracao'
normalizeCategoryKey('BELEZA'); // 'beleza'
```

## Testing

Run the test suite:
```bash
node test-shopee-categories.js
```

## Updating Category IDs

To update the category IDs with real Shopee values:

1. Edit `shopeeCategories.js` and `shopeeCategories.ts`
2. Update the `CATEGORY_PRESETS_BR` object with actual Shopee category IDs
3. Keep the keys in normalized format (lowercase, no accents, underscores for spaces)
4. Run tests to verify: `node test-shopee-categories.js`

## Integration

The backend uses `resolveShopeeCategoryId()` in the `PUT /groups/:id` route to convert user input (either category names or numeric IDs) into numeric IDs before saving to the database.

Users can input:
- Numeric IDs directly: `"100104"`
- Category names: `"Roupas Femininas"`, `"roupas femininas"`, `"ROUPAS FEMININAS"`
- Mixed case and variations

Invalid category names are silently ignored (return null and filtered out).
