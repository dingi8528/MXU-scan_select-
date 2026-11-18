/** Reviewed skins bundled with MXU; configuration cannot name external content. */
export const builtinSkinIds = ['default', 'deepseek', 'naiwa', 'bb-dubai'] as const;
export type BuiltinSkinId = (typeof builtinSkinIds)[number];

/** Old configurations and unrecognized skin identifiers use the standard interface. */
export function normalizeBuiltinSkinId(value: unknown): BuiltinSkinId {
  return builtinSkinIds.find((id) => id === value) ?? 'default';
}
