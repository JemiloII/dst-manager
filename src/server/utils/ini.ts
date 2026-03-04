import fs from 'fs/promises';

export async function renderIniTemplate(
  templatePath: string,
  values: Record<string, string | number | boolean>
): Promise<string> {
  const template = await fs.readFile(templatePath, 'utf-8');
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    if (key in values) return String(values[key]);
    return match;
  });
}
