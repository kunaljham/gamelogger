/** Replace empty lines with a non-breaking space so markdown preserves multiple newlines */
export function preserveNewlines(text: string): string {
  return text
    .split("\n")
    .map((line) => (line === "" ? "\u00A0" : line))
    .join("\n");
}
