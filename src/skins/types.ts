/** Reviewed skins bundled with MXU; configuration cannot name external content. */
export const builtinSkinIds = [
  'default',
  'deepseek',
  'naiwa',
  'bb-dubai',
  'bb-dubai-purple',
] as const;
export type BuiltinSkinId = (typeof builtinSkinIds)[number];

// The blue theme keeps its original saved ID when its display name changes.
export const lunarSkinNames = {
  'bb-dubai': 'settings.skinChaldeaCommand',
  'bb-dubai-purple': 'settings.skinBbDubai',
} as const;

export type LunarSkinId = keyof typeof lunarSkinNames;

export function isLunarSkin(value: unknown): value is LunarSkinId {
  return value === 'bb-dubai' || value === 'bb-dubai-purple';
}

/** Old configurations and unrecognized skin identifiers use the standard interface. */
export function normalizeBuiltinSkinId(value: unknown): BuiltinSkinId {
  return builtinSkinIds.find((id) => id === value) ?? 'default';
}
