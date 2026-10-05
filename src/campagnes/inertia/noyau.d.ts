/** Types minimaux du pont Inertia (noyau.js) pour les modules TypeScript du hub. */
export function requeteInertia(
  url: string,
  options?: { method?: string; data?: unknown; forceFormData?: boolean },
): Promise<{ component?: string; props?: Record<string, unknown>; url?: string; externe?: string }>;
