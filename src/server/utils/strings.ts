export function dedent(str: string): string {
  const lines = str.split('\n');
  
  // Remove first line if it's empty (from template literal)
  if (lines[0] === '') lines.shift();
  
  // Find minimum indentation
  const minIndent = lines
    .filter(line => line.trim().length > 0)
    .reduce((min, line) => {
      const indent = line.match(/^(\s*)/)?.[1].length ?? 0;
      return Math.min(min, indent);
    }, Infinity);
  
  // Remove the common indentation from all lines
  return lines
    .map(line => line.slice(minIndent))
    .join('\n');
}