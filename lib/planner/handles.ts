export function getHandlePolarity(handleId?: string | null): 'plus' | 'minus' | null {
  if (!handleId) return null;
  if (handleId.includes('plus')) return 'plus';
  if (handleId.includes('minus')) return 'minus';
  return null;
}
