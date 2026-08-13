// Gap #14 (GAP-REPORT.md): JobService.create() resolves the platform's
// operational company via process.env.DEFAULT_COMPANY_CODE, read fresh per
// request rather than through the validated `env` singleton (see
// job.service.ts's resolveOperationalCompany for why — in short, this
// suite's job-creating test files each create their own company per run,
// and a frozen-at-boot value could never reflect that).
//
// This helper points that env var at a given test's own company for the
// duration of a test file, and restores whatever was there before
// (typically undefined) afterward — so one file's company never leaks into
// the next file's job-creation calls in this sequential suite
// (vitest.config.ts's fileParallelism:false).
export function withDefaultCompany(companyCode: string): () => void {
  const previous = process.env.DEFAULT_COMPANY_CODE;
  process.env.DEFAULT_COMPANY_CODE = companyCode;

  return function restoreDefaultCompany(): void {
    if (previous === undefined) {
      delete process.env.DEFAULT_COMPANY_CODE;
    } else {
      process.env.DEFAULT_COMPANY_CODE = previous;
    }
  };
}
