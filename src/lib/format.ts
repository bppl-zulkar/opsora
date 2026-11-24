import { formatInTimeZone } from "date-fns-tz";
export const formatIST = (value: string | Date) =>
  `${formatInTimeZone(value, "Asia/Kolkata", "dd MMM yyyy, hh:mm:ss a")} IST`;
export const formatWorkStatus = (status: string) => {
  if (["accepted", "in_progress"].includes(status)) return "WIP";
  if (["pending_verification", "completed", "closed"].includes(status))
    return "Completed";
  if (status === "on_hold") return "On hold";
  return status.replaceAll("_", " ");
};
