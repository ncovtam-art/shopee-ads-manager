// Protect spreadsheet exports from formula execution and preserve CSV quoting.
export function csvCell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
