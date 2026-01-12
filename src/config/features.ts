/**
 * Feature Flags Configuration
 * 
 * This module contains feature flags to enable/disable features in the UI.
 */

// Toggle to re-enable Instagram UI later.
export const FEATURE_INSTAGRAM_ENABLED = false;

// Menu item IDs that are part of the Instagram feature
export const INSTAGRAM_MENU_IDS = ["instagram", "instagram-auto-reply", "instagram-rules"] as const;

/**
 * Check if a menu item ID is an Instagram feature
 */
export const isInstagramMenuId = (id: string): boolean => {
  return (INSTAGRAM_MENU_IDS as readonly string[]).includes(id);
};
