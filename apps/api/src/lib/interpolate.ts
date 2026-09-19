// {{VAR}} interpolation against environment variables.
const VAR_RE = /\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g;

export function interpolate(value: string, vars: Map<string, string>): string {
  return value.replace(VAR_RE, (match, name: string) => vars.get(name) ?? match);
}

export function extractVariables(value: string): string[] {
  return [...value.matchAll(VAR_RE)].map((m) => m[1]);
}

export function unresolvedVariables(value: string, vars: Map<string, string>): string[] {
  return extractVariables(value).filter((v) => !vars.has(v));
}
