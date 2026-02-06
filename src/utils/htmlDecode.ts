/**
 * Decodes HTML entities in a string to their plain text equivalents.
 * Uses a textarea element to leverage the browser's native HTML parsing.
 */
export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return '';
  
  // Use a textarea to decode HTML entities - this handles all standard entities
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}
