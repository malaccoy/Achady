# Changes Comparison - Before and After

## Frontend Changes

### Input Field Change (GroupManager.tsx)

**Before:**
```tsx
<input
  type="number"
  placeholder="ID da categoria (ex: 12345)"
  className="flex-1 px-4 py-2 bg-slate-800..."
  value={categoryIdInput}
  onChange={(e) => setCategoryIdInput(e.target.value)}
/>
```

**After:**
```tsx
<input
  type="text"
  placeholder="Nome ou ID da categoria (ex: Roupas Femininas, 100012)"
  className="flex-1 px-4 py-2 bg-slate-800..."
  value={categoryIdInput}
  onChange={(e) => setCategoryIdInput(e.target.value)}
/>
```

### Input Validation Change (GroupManager.tsx)

**Before:**
```typescript
const addCategoryId = () => {
  if (categoryIdInput.trim()) {
    const catId = parseInt(categoryIdInput.trim(), 10);
    if (!isNaN(catId) && catId > 0 && !editProductCatIds.includes(catId)) {
      setEditProductCatIds([...editProductCatIds, catId]);
      setCategoryIdInput('');
    } else if (catId <= 0) {
      alert('ID de categoria deve ser um número positivo.');
    } else if (editProductCatIds.includes(catId)) {
      alert('Este ID de categoria já foi adicionado.');
    }
  }
};
```

**After:**
```typescript
const addCategoryId = () => {
  const input = categoryIdInput.trim();
  if (!input) return;
  
  // Check if input is purely numeric
  const isNumeric = /^\d+$/.test(input);
  const value = isNumeric ? parseInt(input, 10) : input;
  
  // Check for duplicates by comparing the normalized string representation
  const valueStr = String(value);
  const isDuplicate = editProductCatIds.some(item => String(item) === valueStr);
  
  if (isDuplicate) {
    alert('Esta categoria já foi adicionada.');
    return;
  }
  
  // Add the value (number if numeric, string otherwise)
  setEditProductCatIds([...editProductCatIds, value]);
  setCategoryIdInput('');
};
```

## Backend Changes

### Route Handler Change (achady-server.js)

**Before:**
```javascript
// Handle new productOfferV2 fields
if (productCatIds !== undefined) {
    // Convert array to JSON string for storage
    updateData.productCatIds = Array.isArray(productCatIds) && productCatIds.length > 0 
        ? JSON.stringify(productCatIds) 
        : null;
}
```

**After:**
```javascript
// Handle new productOfferV2 fields with category name/ID resolution
if (productCatIds !== undefined) {
    // Convert array to resolved numeric IDs
    let resolvedCategoryIds = [];
    if (Array.isArray(productCatIds)) {
        resolvedCategoryIds = productCatIds
            .map(item => {
                // Handle both string and number inputs
                const strValue = String(item);
                return resolveShopeeCategoryId(strValue);
            })
            .filter(id => id !== null); // Remove invalid entries
    }
    
    // Convert to JSON string for storage, or null if empty
    updateData.productCatIds = resolvedCategoryIds.length > 0 
        ? JSON.stringify(resolvedCategoryIds) 
        : null;
}
```

## New Files Created

### src/config/shopeeCategories.js

New configuration module with three main exports:

1. **CATEGORY_PRESETS_BR** - Category name to ID mapping
2. **normalizeCategoryKey()** - Text normalization function
3. **resolveShopeeCategoryId()** - ID resolution function

### Example Usage:

```javascript
// Numeric ID input (backward compatible)
resolveShopeeCategoryId('100104')  // → 100104

// Category name input (new feature)
resolveShopeeCategoryId('Roupas Femininas')  // → 100104
resolveShopeeCategoryId('roupas femininas')  // → 100104
resolveShopeeCategoryId('ROUPAS FEMININAS')  // → 100104

// Invalid input
resolveShopeeCategoryId('Invalid Category')  // → null
```

## Type Definition Change

### types.ts

**Before:**
```typescript
productCatIds?: number[];
```

**After:**
```typescript
productCatIds?: (number | string)[];
```

## Data Flow

### Old Flow:
```
User Input → Frontend validates as number → Backend stores as JSON → Database
```

### New Flow:
```
User Input (text or number) 
  → Frontend accepts both 
  → Backend resolves to number via resolveShopeeCategoryId() 
  → Backend filters invalid entries
  → Backend stores as JSON 
  → Database
```

## UI Preview

The user will see this change in the "Categorias Shopee" input field:

**Old Placeholder:**
```
ID da categoria (ex: 12345)
```

**New Placeholder:**
```
Nome ou ID da categoria (ex: Roupas Femininas, 100012)
```

The input field changes from:
- `<input type="number">` (only accepts numbers)

To:
- `<input type="text">` (accepts any text, including category names)

## Backward Compatibility

✅ **Fully Backward Compatible**

All existing numeric IDs continue to work:
- User enters `"100104"` → Resolves to `100104` (number)
- Stored in database as `[100104]`
- Shopee API receives numeric ID as before

No migration needed!
