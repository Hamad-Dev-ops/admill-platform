/**
 * Generates readable business IDs.
 *
 * Examples:
 * CMP-000001
 * DRV-000001
 * VEH-000001
 * CUS-000001
 * JOB-20260731-000001
 */

export const generateBusinessId = (
  prefix: string,
  sequence: number,
  includeDate = false
): string => {
  const formattedSequence = sequence.toString().padStart(6, "0");

  if (!includeDate) {
    return `${prefix}-${formattedSequence}`;
  }

  const now = new Date();

  const year = now.getFullYear();

  const month = String(now.getMonth() + 1).padStart(2, "0");

  const day = String(now.getDate()).padStart(2, "0");

  return `${prefix}-${year}${month}${day}-${formattedSequence}`;
};