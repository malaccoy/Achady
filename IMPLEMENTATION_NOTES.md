# Implementation Notes: Shopee Categories Input Improvement

## Summary

This implementation allows users to configure Shopee categories using either **category names** (e.g., "Roupas Femininas") or **numeric IDs** (e.g., "100104") in the "Grupos WhatsApp" configuration panel.

## What Changed

### Backend Changes

#### 1. New Configuration Module: `src/config/shopeeCategories.js`

Created a reusable configuration module with three main components:

- **`CATEGORY_PRESETS_BR`**: A mapping object that translates friendly Portuguese category names to Shopee LEVEL 1 category IDs. Currently contains placeholder IDs that should be replaced with actual Shopee category IDs.

- **`normalizeCategoryKey(value)`**: Normalizes user input into a standard key format:
  - Converts to lowercase
  - Removes accents/diacritics (é → e, ã → a, etc.)
  - Replaces spaces and symbols with underscores
  - Trims underscores from start/end

- **`resolveShopeeCategoryId(raw)`**: Resolves either numeric IDs or category names to numeric IDs:
  - If input is purely numeric (e.g., "100104"), returns it as a number
  - Otherwise, normalizes the input and looks it up in `CATEGORY_PRESETS_BR`
  - Returns `null` if no match is found

#### 2. Updated Backend Route: `PUT /groups/:id` in `achady-server.js`

Modified the group update route to use `resolveShopeeCategoryId()` for processing category inputs:

```javascript
// Before: Just converted to JSON
updateData.productCatIds = JSON.stringify(productCatIds);

// After: Resolves names to IDs, filters out invalid entries
let resolvedCategoryIds = productCatIds
  .map(item => resolveShopeeCategoryId(String(item)))
  .filter(id => id !== null);
updateData.productCatIds = JSON.stringify(resolvedCategoryIds);
```

### Frontend Changes

#### 1. Updated Input Field in `GroupManager.tsx`

Changed the "Categorias Shopee" input from `type="number"` to `type="text"` to accept both names and IDs:

```tsx
// Before
<input type="number" placeholder="ID da categoria (ex: 12345)" />

// After
<input type="text" placeholder="Nome ou ID da categoria (ex: Roupas Femininas, 100012)" />
```

#### 2. Updated Input Handling Logic

Modified the `addCategoryId()` function to accept both text and numeric inputs:

```javascript
const addCategoryId = () => {
  const input = categoryIdInput.trim();
  if (!input) return;
  
  // Check if input is purely numeric
  const isNumeric = /^\d+$/.test(input);
  const value = isNumeric ? parseInt(input, 10) : input;
  
  // Check for duplicates and add
  // ...
};
```

#### 3. Updated Type Definition in `types.ts`

Changed the type to accept both strings and numbers:

```typescript
// Before
productCatIds?: number[];

// After
productCatIds?: (number | string)[];
```

## User Experience

### For Existing Users (Numeric IDs)
- **No change required** - existing workflows continue to work exactly as before
- Users who enter "100104" will get 100104 stored in the database

### For New Feature (Category Names)
- Users can now type friendly names like:
  - "Roupas Femininas"
  - "Casa & Decoração"
  - "Beleza"
- Case insensitive: "beleza", "BELEZA", "Beleza" all work
- Accent insensitive: "Decoração", "Decoracao" both work
- Backend converts these to numeric IDs automatically

### Invalid Inputs
- Invalid category names are silently ignored (not added to the list)
- No error messages shown to avoid confusion
- Only valid, resolved IDs are saved to the database

## Testing

A comprehensive test suite (`test-shopee-categories.js`) validates:
- Normalization logic (6 tests)
- Numeric ID resolution (4 tests)
- Category name resolution (7 tests)
- Invalid input handling (6 tests)
- Backend array processing (5 tests)

**Result: 28/28 tests passing ✓**

To run tests:
```bash
node test-shopee-categories.js
```

## Next Steps

### 1. Replace Placeholder Category IDs

The current implementation uses placeholder IDs. To use real Shopee categories:

1. Open `src/config/shopeeCategories.js`
2. Update the `CATEGORY_PRESETS_BR` object with actual Shopee LEVEL 1 category IDs
3. Example:
   ```javascript
   const CATEGORY_PRESETS_BR = {
     'roupas_femininas': 11001234,  // Replace with real ID
     'beleza': 11001567,             // Replace with real ID
     // ...
   };
   ```

### 2. Add More Categories

To add more category mappings:

1. Determine the normalized key (use `normalizeCategoryKey()` helper)
2. Find the Shopee category ID
3. Add to `CATEGORY_PRESETS_BR` in both `.js` and `.ts` files

Example:
```javascript
'joias_acessorios': 11002345,  // Joias & Acessórios
'instrumentos_musicais': 11002456,  // Instrumentos Musicais
```

### 3. User Documentation

Consider adding a help tooltip or info icon in the UI explaining:
- Users can enter either category IDs or names
- Show examples of valid category names
- List available category presets

## Security

- ✓ CodeQL security scan completed - no issues found
- ✓ Input validation: only numeric IDs are stored in database
- ✓ No SQL injection risk: Prisma ORM handles parameterization
- ✓ No XSS risk: React handles escaping automatically

## Build Status

- ✓ TypeScript compilation successful
- ✓ Vite build successful
- ✓ No linting errors
- ✓ All dependencies installed correctly

## Files Modified/Created

**Created:**
- `src/config/shopeeCategories.js` - Main implementation (CommonJS)
- `src/config/shopeeCategories.ts` - TypeScript definitions
- `src/config/README.md` - Configuration documentation
- `test-shopee-categories.js` - Test suite
- `IMPLEMENTATION_NOTES.md` - This file

**Modified:**
- `achady-server.js` - Updated PUT /groups/:id route
- `components/GroupManager.tsx` - Updated input field and logic
- `types.ts` - Updated Group interface

## Backward Compatibility

✓ **100% backward compatible**
- Existing numeric IDs continue to work without any changes
- No migration required
- No breaking changes to API or database schema
- Frontend gracefully handles both old and new data formats
