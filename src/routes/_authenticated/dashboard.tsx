import { createFileRoute } from "@tanstack/react-router";
import { CaseTracker } from "@/components/case-tracker/CaseTracker";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: CaseTracker,
});