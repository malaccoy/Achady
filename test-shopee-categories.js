/**
 * Test file for Shopee Categories functionality
 * 
 * This file demonstrates and validates the category name/ID resolution feature.
 * Run with: node test-shopee-categories.js
 */

const { normalizeCategoryKey, resolveShopeeCategoryId, CATEGORY_PRESETS_BR } = require('./src/config/shopeeCategories.js');

console.log('='.repeat(60));
console.log('SHOPEE CATEGORIES TEST SUITE');
console.log('='.repeat(60));
console.log();

// Test 1: normalizeCategoryKey function
console.log('Test 1: normalizeCategoryKey()');
console.log('-'.repeat(60));
const normalizeTests = [
  ['Roupas Femininas', 'roupas_femininas'],
  ['Casa & Decoração', 'casa_decoracao'],
  ['BELEZA', 'beleza'],
  ['Celulares & Tablets', 'celulares_tablets'],
  ['Bebês e Crianças', 'bebes_e_criancas'],
  ['  Pet Shop  ', 'pet_shop'],
];

let normalizePass = 0;
normalizeTests.forEach(([input, expected]) => {
  const result = normalizeCategoryKey(input);
  const pass = result === expected;
  console.log(`  ${pass ? '✓' : '✗'} "${input}" => "${result}" ${!pass ? `(expected: "${expected}")` : ''}`);
  if (pass) normalizePass++;
});
console.log(`  ${normalizePass}/${normalizeTests.length} tests passed`);
console.log();

// Test 2: resolveShopeeCategoryId with numeric IDs
console.log('Test 2: resolveShopeeCategoryId() with numeric IDs');
console.log('-'.repeat(60));
const numericTests = [
  ['100104', 100104],
  ['100109', 100109],
  ['  100120  ', 100120],
  ['999999', 999999],
];

let numericPass = 0;
numericTests.forEach(([input, expected]) => {
  const result = resolveShopeeCategoryId(input);
  const pass = result === expected;
  console.log(`  ${pass ? '✓' : '✗'} "${input}" => ${result} ${!pass ? `(expected: ${expected})` : ''}`);
  if (pass) numericPass++;
});
console.log(`  ${numericPass}/${numericTests.length} tests passed`);
console.log();

// Test 3: resolveShopeeCategoryId with category names
console.log('Test 3: resolveShopeeCategoryId() with category names');
console.log('-'.repeat(60));
const nameTests = [
  ['Roupas Femininas', 100104],
  ['roupas femininas', 100104],
  ['ROUPAS FEMININAS', 100104],
  ['Beleza', 100109],
  ['Casa & Decoração', 100113],
  ['casa decoração', 100113],
  ['Pet Shop', 100118],
];

let namePass = 0;
nameTests.forEach(([input, expected]) => {
  const result = resolveShopeeCategoryId(input);
  const pass = result === expected;
  console.log(`  ${pass ? '✓' : '✗'} "${input}" => ${result} ${!pass ? `(expected: ${expected})` : ''}`);
  if (pass) namePass++;
});
console.log(`  ${namePass}/${nameTests.length} tests passed`);
console.log();

// Test 4: Invalid inputs (should return null)
console.log('Test 4: Invalid inputs (should return null)');
console.log('-'.repeat(60));
const invalidTests = [
  'Invalid Category',
  'NonExistent',
  '',
  '   ',
  '0',
  '-100',
];

let invalidPass = 0;
invalidTests.forEach(input => {
  const result = resolveShopeeCategoryId(input);
  const pass = result === null;
  console.log(`  ${pass ? '✓' : '✗'} "${input}" => ${result} ${!pass ? '(expected: null)' : ''}`);
  if (pass) invalidPass++;
});
console.log(`  ${invalidPass}/${invalidTests.length} tests passed`);
console.log();

// Test 5: Backend simulation - processing arrays
console.log('Test 5: Backend simulation - processing arrays');
console.log('-'.repeat(60));

function processProductCatIds(productCatIds) {
  let resolvedCategoryIds = [];
  if (Array.isArray(productCatIds)) {
    resolvedCategoryIds = productCatIds
      .map(item => {
        const strValue = String(item);
        return resolveShopeeCategoryId(strValue);
      })
      .filter(id => id !== null);
  }
  return resolvedCategoryIds;
}

const arrayTests = [
  {
    name: 'Only numeric IDs',
    input: ['100104', '100109', '100120'],
    expected: [100104, 100109, 100120],
  },
  {
    name: 'Only category names',
    input: ['Roupas Femininas', 'Beleza', 'Games'],
    expected: [100104, 100109, 100120],
  },
  {
    name: 'Mixed IDs and names',
    input: ['100104', 'Beleza', '100120', 'Casa & Decoração'],
    expected: [100104, 100109, 100120, 100113],
  },
  {
    name: 'With invalid entries (should be filtered out)',
    input: ['Roupas Femininas', 'Invalid', 'Beleza', 'NonExistent'],
    expected: [100104, 100109],
  },
  {
    name: 'Empty array',
    input: [],
    expected: [],
  },
];

let arrayPass = 0;
arrayTests.forEach(({ name, input, expected }) => {
  const result = processProductCatIds(input);
  const pass = JSON.stringify(result) === JSON.stringify(expected);
  console.log(`  ${pass ? '✓' : '✗'} ${name}`);
  console.log(`      Input: [${input.map(i => `"${i}"`).join(', ')}]`);
  console.log(`      Output: [${result.join(', ')}]`);
  if (!pass) {
    console.log(`      Expected: [${expected.join(', ')}]`);
  }
  if (pass) arrayPass++;
});
console.log(`  ${arrayPass}/${arrayTests.length} tests passed`);
console.log();

// Summary
console.log('='.repeat(60));
console.log('SUMMARY');
console.log('='.repeat(60));
const totalTests = normalizeTests.length + numericTests.length + nameTests.length + invalidTests.length + arrayTests.length;
const totalPass = normalizePass + numericPass + namePass + invalidPass + arrayPass;
console.log(`Total: ${totalPass}/${totalTests} tests passed`);

if (totalPass === totalTests) {
  console.log('✓ ALL TESTS PASSED!');
  process.exit(0);
} else {
  console.log('✗ SOME TESTS FAILED');
  process.exit(1);
}
