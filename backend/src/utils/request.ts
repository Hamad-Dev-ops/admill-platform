import { Request } from "express";

// Express 5's param typing is `string | string[]` (path-to-regexp v6+ wildcards can
// produce arrays); none of our routes use wildcards, so this always resolves to a
// plain string in practice — this just narrows the type at the one place it matters.
export function getParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value;
}
