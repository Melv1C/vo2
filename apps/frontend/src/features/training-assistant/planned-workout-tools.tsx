import { Button } from "@repo/ui/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/ui/collapsible";
import { type ToolProps } from "@tanstack/ai-react/ui";
import { useQueryClient } from "@tanstack/react-query";
import { ActivityIcon, CheckCircle2Icon, ChevronDownIcon } from "lucide-react";
import { useEffect } from "react";

import { plannedWorkoutsQueryKey } from "@/lib/planned-workouts-query";

import type { TrainingAssistantChatOptions } from "./chat-options";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatPlanDate(value: unknown): string {
  if (typeof value !== "string") return "an unspecified day";
  return new Date(value + "T12:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

type PlanningToolProps =
  | ToolProps<TrainingAssistantChatOptions, "create_planned_workout">
  | ToolProps<TrainingAssistantChatOptions, "update_planned_workout">
  | ToolProps<TrainingAssistantChatOptions, "delete_planned_workout">;
type PlanningToolInput = NonNullable<PlanningToolProps["part"]["input"]>;

function approvalSummary(input: PlanningToolInput | undefined, action: string): string {
  if (!input) return action + " this planned workout";
  const sport = "sport" in input && input.sport ? input.sport : "planned workout";
  const duration =
    "durationMinutes" in input && input.durationMinutes
      ? " for " + input.durationMinutes + " min"
      : "";
  const date = "date" in input && input.date ? " on " + formatPlanDate(input.date) : "";
  return action + " a " + sport + duration + date;
}

function PlannedWorkoutToolCard({
  part,
  interrupt,
  result,
  action,
}: PlanningToolProps & {
  action: string;
}) {
  const queryClient = useQueryClient();
  const isPending = interrupt?.status === "pending" || interrupt?.status === "staged";
  const isSubmitting = interrupt?.status === "submitting" || interrupt?.status === "validating";
  const isComplete = part.state === "complete" || result?.state === "complete";

  useEffect(() => {
    if (isComplete) void queryClient.invalidateQueries({ queryKey: plannedWorkoutsQueryKey });
  }, [isComplete, queryClient]);

  return (
    <div className="bg-primary/5 border-primary/20 w-full max-w-[90%] rounded-xl border px-3 py-2.5 text-xs">
      <div className="flex items-center gap-2">
        <CheckCircle2Icon
          className={isPending ? "text-primary size-3.5" : "text-muted-foreground size-3.5"}
        />
        <span className="font-medium">{approvalSummary(part.input, action)}</span>
      </div>
      {isPending && interrupt ? (
        <div className="mt-2 flex gap-2">
          <Button size="xs" onClick={() => interrupt.resolveInterrupt(true)}>
            Confirm
          </Button>
          <Button size="xs" variant="outline" onClick={() => interrupt.resolveInterrupt(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground mt-1">
          {isSubmitting
            ? "Waiting for the update…"
            : part.state === "error" || result?.state === "error"
              ? "The update failed."
              : "Update complete"}
        </p>
      )}
    </div>
  );
}

export function ListPlannedWorkoutsTool({
  part,
  result,
}: ToolProps<TrainingAssistantChatOptions, "list_planned_workouts">) {
  const output = part.output ?? result?.content;
  const count = isRecord(output) && Array.isArray(output.workouts) ? output.workouts.length : null;
  return (
    <Collapsible className="group">
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 py-1 text-left text-xs transition-colors">
        <ActivityIcon className="size-3.5" />
        <span className="flex-1 font-medium">Training plan</span>
        <span className="text-[11px]">
          {count == null ? "Loading" : count + " workout" + (count === 1 ? "" : "s")}
        </span>
        <ChevronDownIcon className="size-3.5 shrink-0 transition-transform group-aria-expanded:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="text-muted-foreground ml-1.5 border-l pl-5">
        <pre className="max-h-40 overflow-auto py-1 font-mono text-[10px] leading-relaxed break-words whitespace-pre-wrap">
          {typeof output === "string"
            ? output
            : (JSON.stringify(output, null, 2) ?? "No plan output yet.")}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CreatePlannedWorkoutTool({
  part,
  interrupt,
  result,
}: ToolProps<TrainingAssistantChatOptions, "create_planned_workout">) {
  return <PlannedWorkoutToolCard part={part} interrupt={interrupt} result={result} action="Plan" />;
}

export function UpdatePlannedWorkoutTool({
  part,
  interrupt,
  result,
}: ToolProps<TrainingAssistantChatOptions, "update_planned_workout">) {
  return (
    <PlannedWorkoutToolCard part={part} interrupt={interrupt} result={result} action="Update" />
  );
}

export function DeletePlannedWorkoutTool({
  part,
  interrupt,
  result,
}: ToolProps<TrainingAssistantChatOptions, "delete_planned_workout">) {
  return (
    <PlannedWorkoutToolCard part={part} interrupt={interrupt} result={result} action="Delete" />
  );
}
