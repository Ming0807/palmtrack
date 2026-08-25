export const ROLES = [
  "admin",
  "research_manager",
  "field_collector",
  "farmer",
  "evaluator_readonly",
] as const;

export type Role = (typeof ROLES)[number];

const roleSet = new Set<string>(ROLES);

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roleSet.has(value);
}
