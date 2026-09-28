import type { DocumentJob } from "../workspace/types";

export const describeJobStatus = (job: DocumentJob, notice: string) => {
  if (job.phase === "cancelling") {
    return "Cancelling. Waiting for the worker to stop...";
  }
  if (job.phase === "cancelled") {
    return "Merge cancelled. Your inputs and order are unchanged.";
  }
  if (job.phase !== "processing") {
    return notice;
  }
  if (job.progress?.phase === "copying") {
    return `Copied ${job.progress.completed} pages...`;
  }
  if (job.progress?.phase === "saving") {
    return "Saving the merged PDF...";
  }
  if (job.progress) {
    return `Checking input ${job.progress.completed + 1} of ${job.progress.total}...`;
  }
  return "Starting the local merge worker...";
};
