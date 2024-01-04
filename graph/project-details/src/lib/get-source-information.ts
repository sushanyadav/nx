export function getSourceInformation(
  sourceMap: Record<string, string[]>,
  key: string
): string | undefined {
  const sourceInfo = sourceMap?.[key];
  if (sourceInfo) {
    return ` ${sourceInfo[1]}(${sourceInfo[0]})`;
  }
  if (!key.includes('.')) {
    return undefined;
  }
  return getSourceInformation(
    sourceMap,
    key.substring(0, key.lastIndexOf('.'))
  );
}
