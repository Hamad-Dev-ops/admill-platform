import { JobStatus } from "../../constants/job.enum";
import { AppError } from "../../errors/AppError";

const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.PENDING]: [JobStatus.ACCEPTED, JobStatus.CANCELLED, JobStatus.EXPIRED],
  [JobStatus.ACCEPTED]: [JobStatus.EN_ROUTE, JobStatus.CANCELLED],
  [JobStatus.EN_ROUTE]: [JobStatus.ARRIVED, JobStatus.CANCELLED],
  [JobStatus.ARRIVED]: [JobStatus.STARTED, JobStatus.CANCELLED],
  [JobStatus.STARTED]: [JobStatus.COMPLETED, JobStatus.CANCELLED],
  [JobStatus.COMPLETED]: [],
  [JobStatus.CANCELLED]: [],
  [JobStatus.EXPIRED]: [],
};

export const JobStateMachine = {
  assertCanTransition(from: JobStatus, to: JobStatus): void {
    const allowed = TRANSITIONS[from] ?? [];

    if (!allowed.includes(to)) {
      throw new AppError(400, `Cannot transition job from ${from} to ${to}`);
    }
  },
};
