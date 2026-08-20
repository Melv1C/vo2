import { Button } from "@repo/ui/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useEffect, useState } from "react";

import {
  updateAthleteZones,
  type AthleteZoneRange,
  type AthleteZoneType,
  type AthleteZonesResponse,
} from "@/lib/athlete-api";
import {
  athleteProfileQueryOptions,
  athleteZonesQueryKey,
  athleteZonesQueryOptions,
} from "@/lib/athlete-query";
import { formatPaceClock, mpsToSecPerKm, parsePaceClock, secPerKmToMps } from "@/lib/pace";
import { defaultHrZones, defaultPaceZones, defaultPowerZones } from "@/lib/zone-defaults";

type ZoneDraft = {
  min: string;
  max: string;
};

type ZonesDraft = Record<AthleteZoneType, ZoneDraft[]>;

const ZONE_TYPES: { type: AthleteZoneType; label: string; unit: string }[] = [
  { type: "hr", label: "Heart rate", unit: "bpm" },
  { type: "power", label: "Power", unit: "W" },
  { type: "pace", label: "Pace", unit: "min/km" },
];

function emptyDraft(): ZonesDraft {
  return { hr: [], power: [], pace: [] };
}

function zonesToDraft(zones: AthleteZonesResponse): ZonesDraft {
  return {
    hr: zones.hr.map((z) => ({ min: String(z.min), max: String(z.max) })),
    power: zones.power.map((z) => ({ min: String(z.min), max: String(z.max) })),
    pace: zones.pace.map((z) => ({
      min: formatPaceClock(mpsToSecPerKm(z.min)),
      max: formatPaceClock(mpsToSecPerKm(z.max)),
    })),
  };
}

function rangesToDraft(type: AthleteZoneType, ranges: AthleteZoneRange[]): ZoneDraft[] {
  if (type === "pace") {
    return ranges.map((z) => ({
      min: formatPaceClock(mpsToSecPerKm(z.min)),
      max: formatPaceClock(mpsToSecPerKm(z.max)),
    }));
  }
  return ranges.map((z) => ({ min: String(z.min), max: String(z.max) }));
}

function parseHrOrPower(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseZoneRows(
  type: AthleteZoneType,
  rows: ZoneDraft[],
): { ok: true; zones: AthleteZoneRange[] } | { ok: false; error: string } {
  const zones: AthleteZoneRange[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    let min: number | null;
    let max: number | null;

    if (type === "pace") {
      const minSec = parsePaceClock(row.min);
      const maxSec = parsePaceClock(row.max);
      // UI is min/km (slower = larger clock). API stores m/s (faster = higher).
      // Zone "min" field is the slower bound (higher clock → lower mps).
      min = minSec == null ? null : secPerKmToMps(minSec);
      max = maxSec == null ? null : secPerKmToMps(maxSec);
      if (min == null || max == null) {
        return { ok: false, error: `Zone ${i + 1}: use m:ss pace (e.g. 5:00)` };
      }
      // After conversion, slower pace has lower mps — ensure min_mps < max_mps by swapping if needed
      // User enters slower clock in "min" and faster in "max" (training zone convention: Z1 slow → Z5 fast).
      // So min field = slower = larger sec = smaller mps. max field = faster = smaller sec = larger mps.
      if (min > max) {
        const tmp = min;
        min = max;
        max = tmp;
      }
    } else {
      min = parseHrOrPower(row.min);
      max = parseHrOrPower(row.max);
      if (min == null || max == null) {
        return { ok: false, error: `Zone ${i + 1}: enter numeric min and max` };
      }
      if (min > max) {
        return { ok: false, error: `Zone ${i + 1}: min must be ≤ max` };
      }
    }

    zones.push({ min, max });
  }

  if (zones.length > 10) {
    return { ok: false, error: "At most 10 zones" };
  }

  return { ok: true, zones };
}

export function AthleteZonesForm() {
  const queryClient = useQueryClient();
  const { data: zones, isLoading, isError } = useQuery(athleteZonesQueryOptions);
  const { data: profile } = useQuery(athleteProfileQueryOptions);
  const [draft, setDraft] = useState<ZonesDraft>(emptyDraft());
  const [activeType, setActiveType] = useState<AthleteZoneType>("hr");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (zones) {
      setDraft(zonesToDraft(zones));
    }
  }, [zones]);

  const save = useMutation({
    mutationFn: updateAthleteZones,
    onSuccess: async (result) => {
      setError(null);
      setMessage(`${ZONE_TYPES.find((z) => z.type === activeType)?.label} zones saved`);
      setDraft((prev) => ({
        ...prev,
        [activeType]: rangesToDraft(activeType, result[activeType]),
      }));
      await queryClient.invalidateQueries({ queryKey: athleteZonesQueryKey });
    },
    onError: () => {
      setMessage(null);
      setError("Could not save zones");
    },
  });

  function updateRow(type: AthleteZoneType, index: number, key: "min" | "max", value: string) {
    setDraft((prev) => ({
      ...prev,
      [type]: prev[type].map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    }));
    setMessage(null);
  }

  function addRow(type: AthleteZoneType) {
    setDraft((prev) => {
      if (prev[type].length >= 10) {
        return prev;
      }
      return {
        ...prev,
        [type]: [...prev[type], { min: "", max: "" }],
      };
    });
    setMessage(null);
  }

  function removeRow(type: AthleteZoneType, index: number) {
    setDraft((prev) => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }));
    setMessage(null);
  }

  function fillDefaults(type: AthleteZoneType) {
    let ranges: AthleteZoneRange[] | null = null;

    if (type === "hr") {
      if (profile?.lthr == null) {
        setError("Set LTHR in your profile before filling HR zones");
        return;
      }
      ranges = defaultHrZones(profile.lthr);
    } else if (type === "power") {
      if (profile?.ftp == null) {
        setError("Set FTP in your profile before filling power zones");
        return;
      }
      ranges = defaultPowerZones(profile.ftp);
    } else if (profile?.thresholdPaceMps == null) {
      setError("Set threshold pace in your profile before filling pace zones");
      return;
    } else {
      ranges = defaultPaceZones(profile.thresholdPaceMps);
    }

    setError(null);
    setDraft((prev) => ({
      ...prev,
      [type]: rangesToDraft(type, ranges!),
    }));
    setMessage(`Filled ${type} zones from anchors (not saved yet)`);
  }

  function onSave(type: AthleteZoneType) {
    const parsed = parseZoneRows(type, draft[type]);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    save.mutate({ type, zones: parsed.zones });
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Training zones</CardTitle>
          <CardDescription>Loading zones…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Training zones</CardTitle>
          <CardDescription className="text-destructive">Failed to load zones</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const meta = ZONE_TYPES.find((z) => z.type === activeType)!;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Training zones</CardTitle>
        <CardDescription>
          Optional custom ranges for HR, power, and pace. Fill from anchors uses Friel (HR), Coggan
          (power), and threshold fractions (pace).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={activeType}
          onValueChange={(value) => {
            if (value === "hr" || value === "power" || value === "pace") {
              setActiveType(value);
              setError(null);
              setMessage(null);
            }
          }}
        >
          <TabsList>
            {ZONE_TYPES.map((z) => (
              <TabsTrigger key={z.type} value={z.type}>
                {z.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {ZONE_TYPES.map((z) => (
            <TabsContent key={z.type} value={z.type} className="mt-4 flex flex-col gap-3">
              <FieldDescription>
                Values in {z.unit}
                {z.type === "pace" ? " (slower → faster from zone 1 up)" : ""}. Max 10 zones.
              </FieldDescription>

              {draft[z.type].length === 0 ? (
                <p className="text-muted-foreground text-xs">No zones yet.</p>
              ) : (
                <FieldGroup className="gap-3">
                  {draft[z.type].map((row, index) => (
                    <div key={index} className="flex flex-wrap items-end gap-2">
                      <Field className="min-w-[7rem] flex-1">
                        <FieldLabel htmlFor={`${z.type}-min-${index}`}>
                          Z{index + 1} {z.type === "pace" ? "slow" : "min"}
                        </FieldLabel>
                        <Input
                          id={`${z.type}-min-${index}`}
                          value={row.min}
                          onChange={(e) => updateRow(z.type, index, "min", e.target.value)}
                          placeholder={z.type === "pace" ? "5:30" : "0"}
                        />
                      </Field>
                      <Field className="min-w-[7rem] flex-1">
                        <FieldLabel htmlFor={`${z.type}-max-${index}`}>
                          {z.type === "pace" ? "fast" : "max"}
                        </FieldLabel>
                        <Input
                          id={`${z.type}-max-${index}`}
                          value={row.max}
                          onChange={(e) => updateRow(z.type, index, "max", e.target.value)}
                          placeholder={z.type === "pace" ? "4:45" : "100"}
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Remove zone ${index + 1}`}
                        onClick={() => removeRow(z.type, index)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  ))}
                </FieldGroup>
              )}
            </TabsContent>
          ))}
        </Tabs>

        {error && <FieldError className="mt-3">{error}</FieldError>}
        {message && <p className="text-muted-foreground mt-3 text-xs">{message}</p>}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2 border-t">
        <Button type="button" onClick={() => onSave(activeType)} disabled={save.isPending}>
          {save.isPending ? "Saving…" : `Save ${meta.label.toLowerCase()} zones`}
        </Button>
        <Button type="button" variant="outline" onClick={() => addRow(activeType)}>
          <PlusIcon data-icon="inline-start" />
          Add zone
        </Button>
        <Button type="button" variant="outline" onClick={() => fillDefaults(activeType)}>
          Fill from anchors
        </Button>
      </CardFooter>
    </Card>
  );
}
