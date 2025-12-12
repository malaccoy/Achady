/**
 * Shopee Categories Configuration
 * 
 * This module provides a mapping of friendly category names to Shopee LEVEL 1 category IDs,
 * along with helper functions to normalize and resolve category identifiers.
 */

/**
 * Mapping of normalized category keys to Shopee LEVEL 1 category IDs
 * Keys are in lowercase with underscores, without accents
 * 
 * IMPORTANT: The IDs here are placeholders. These should be replaced with 
 * actual Shopee category IDs before production use. The user will fill in 
 * the real IDs as needed.
 */
export const CATEGORY_PRESETS_BR: Record<string, number> = {
  // Example mappings (to be filled with real Shopee category IDs)
  'roupas_femininas': 100104,
  'roupas_masculinas': 100105,
  'calcados_femininos': 100106,
  'calcados_masculinos': 100107,
  'bolsas_acessorios': 100108,
  'beleza': 100109,
  'eletronicos': 100110,
  'celulares_tablets': 100111,
  'computadores_acessorios': 100112,
  'casa_decoracao': 100113,
  'cozinha': 100114,
  'esportes': 100115,
  'brinquedos': 100116,
  'bebes_criancas': 100117,
  'pet_shop': 100118,
  'automotivo': 100119,
  'games': 100120,
  'livros': 100121,
  'saude': 100122,
  'alimentacao': 100123,
};

/**
 * Normalizes a category input string into a standardized key format
 * 
 * - Converts to lowercase
 * - Removes accents/diacritics
 * - Replaces spaces and symbols with underscores
 * - Trims underscores from start and end
 * 
 * @param value - The input string to normalize
 * @returns Normalized key string
 * 
 * @example
 * normalizeCategoryKey('Roupas Femininas') // returns 'roupas_femininas'
 * normalizeCategoryKey('Casa & Decoração') // returns 'casa_e_decoracao'
 */
export function normalizeCategoryKey(value: string): string {
  if (!value) return '';
  
  return value
    .toLowerCase()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9]+/g, '_') // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, ''); // Trim underscores from start/end
}

/**
 * Resolves a category input to a numeric Shopee category ID
 * 
 * - If input is purely numeric, returns it as a number
 * - Otherwise, normalizes the input and looks it up in CATEGORY_PRESETS_BR
 * - Returns null if no match is found
 * 
 * @param raw - The raw input string (can be a numeric ID or category name)
 * @returns The numeric category ID, or null if not found/invalid
 * 
 * @example
 * resolveShopeeCategoryId('100104') // returns 100104
 * resolveShopeeCategoryId('Roupas Femininas') // returns 100104
 * resolveShopeeCategoryId('roupas femininas') // returns 100104
 * resolveShopeeCategoryId('invalid') // returns null
 */
export function resolveShopeeCategoryId(raw: string): number | null {
  if (!raw || typeof raw !== 'string') return null;
  
  const trimmed = raw.trim();
  if (!trimmed) return null;
  
  // Check if input is purely numeric
  if (/^\d+$/.test(trimmed)) {
    const numericId = Number(trimmed);
    return numericId > 0 ? numericId : null;
  }
  
  // Normalize and lookup in preset mapping
  const normalizedKey = normalizeCategoryKey(trimmed);
  if (normalizedKey && CATEGORY_PRESETS_BR[normalizedKey]) {
    return CATEGORY_PRESETS_BR[normalizedKey];
  }
  
  return null;
}
