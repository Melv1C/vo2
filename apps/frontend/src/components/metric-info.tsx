import { Button } from "@repo/ui/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";

export function MetricInfo({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-xs" />} aria-label={label}>
        <InfoIcon />
      </TooltipTrigger>
      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
}
