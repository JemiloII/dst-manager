export function dedent(str: string): string {
  const lines = str.split('\n');
  
  if (lines[0] === '') lines.shift();
  if (lines[lines.length - 1] && lines[lines.length - 1].trim() === '') lines.pop();
  
  const minIndent = lines
    .filter(line => line.length > 0)
    .reduce((min, line) => {
      const match = line.match(/^[ \t]*/);
      const indent = match ? match[0].length : 0;
      return line.trim().length > 0 ? Math.min(min, indent) : min;
    }, Infinity);
  
  if (minIndent === Infinity) return '';
  
  return lines
    .map(line => line.slice(minIndent))
    .join('\n');
}