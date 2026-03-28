export const normalizeHash = (value?: string): string => {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return '';
  }

  if (normalized.startsWith('0x')) {
    return normalized;
  }

  return `0x${normalized}`;
};
