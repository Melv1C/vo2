import { Alert, AlertAction, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Badge } from "@repo/ui/components/ui/badge";
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
  FieldSet,
} from "@repo/ui/components/ui/field";
import { Input } from "@repo/ui/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@repo/ui/components/ui/native-select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";

import {
  updateAthleteProfile,
  type AthleteProfileResponse,
  type UpdateAthleteProfileInput,
} from "@/lib/athlete-api";
import { athleteProfileQueryKey, athleteProfileQueryOptions } from "@/lib/athlete-query";
import { recomputeMetrics } from "@/lib/metrics-api";
import { dailyMetricsQueryKey } from "@/lib/metrics-query";
import {
  mpsToRunPaceInput,
  mpsToSwimPaceInput,
  runPaceInputToMps,
  swimPaceInputToMps,
} from "@/lib/pace";

type ProfileFormState = {
  sex: "" | "M" | "F";
  birthdate: string;
  heightCm: string;
  weightKg: string;
  restingHr: string;
  maxHr: string;
  lthr: string;
  ftp: string;
  thresholdRunPace: string;
  thresholdSwimPace: string;
};

type FieldErrors = Partial<Record<keyof ProfileFormState, string>>;

function profileToForm(profile: AthleteProfileResponse): ProfileFormState {
  return {
    sex: profile.sex === "M" || profile.sex === "F" ? profile.sex : "",
    birthdate: profile.birthdate ?? "",
    heightCm: profile.heightCm != null ? String(profile.heightCm) : "",
    weightKg: profile.weightKg != null ? String(profile.weightKg) : "",
    restingHr: profile.restingHr != null ? String(profile.restingHr) : "",
    maxHr: profile.maxHr != null ? String(profile.maxHr) : "",
    lthr: profile.lthr != null ? String(profile.lthr) : "",
    ftp: profile.ftp != null ? String(profile.ftp) : "",
    thresholdRunPace: mpsToRunPaceInput(profile.thresholdPaceMps),
    thresholdSwimPace: mpsToSwimPaceInput(profile.thresholdSwimPaceMps),
  };
}

function parseOptionalNumber(
  value: string,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = value.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return { ok: false, error: `${label} must be a number` };
  }
  return { ok: true, value: n };
}

function parseOptionalInt(
  value: string,
  label: string,
): { ok: true; value: number | null } | { ok: false; error: string } {
  const parsed = parseOptionalNumber(value, label);
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.value == null) {
    return parsed;
  }
  if (!Number.isInteger(parsed.value)) {
    return { ok: false, error: `${label} must be a whole number` };
  }
  return parsed;
}

function buildUpdatePayload(
  form: ProfileFormState,
): { ok: true; input: UpdateAthleteProfileInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const heightCm = parseOptionalNumber(form.heightCm, "Height");
  if (!heightCm.ok) errors.heightCm = heightCm.error;
  else if (heightCm.value != null && (heightCm.value < 100 || heightCm.value > 250)) {
    errors.heightCm = "Height must be between 100 and 250 cm";
  }

  const weightKg = parseOptionalNumber(form.weightKg, "Weight");
  if (!weightKg.ok) errors.weightKg = weightKg.error;
  else if (weightKg.value != null && (weightKg.value < 30 || weightKg.value > 200)) {
    errors.weightKg = "Weight must be between 30 and 200 kg";
  }

  const restingHr = parseOptionalInt(form.restingHr, "Resting HR");
  if (!restingHr.ok) errors.restingHr = restingHr.error;
  else if (restingHr.value != null && (restingHr.value < 30 || restingHr.value > 120)) {
    errors.restingHr = "Resting HR must be between 30 and 120";
  }

  const maxHr = parseOptionalInt(form.maxHr, "Max HR");
  if (!maxHr.ok) errors.maxHr = maxHr.error;
  else if (maxHr.value != null && (maxHr.value < 100 || maxHr.value > 250)) {
    errors.maxHr = "Max HR must be between 100 and 250";
  }

  const lthr = parseOptionalInt(form.lthr, "LTHR");
  if (!lthr.ok) errors.lthr = lthr.error;
  else if (lthr.value != null && (lthr.value < 100 || lthr.value > 220)) {
    errors.lthr = "LTHR must be between 100 and 220";
  }

  const ftp = parseOptionalInt(form.ftp, "FTP");
  if (!ftp.ok) errors.ftp = ftp.error;
  else if (ftp.value != null && (ftp.value < 50 || ftp.value > 600)) {
    errors.ftp = "FTP must be between 50 and 600 W";
  }

  let thresholdPaceMps: number | null = null;
  if (form.thresholdRunPace.trim() !== "") {
    const mps = runPaceInputToMps(form.thresholdRunPace);
    if (mps == null || mps < 1 || mps > 10) {
      errors.thresholdRunPace = "Use m:ss per km (e.g. 4:30)";
    } else {
      thresholdPaceMps = mps;
    }
  }

  let thresholdSwimPaceMps: number | null = null;
  if (form.thresholdSwimPace.trim() !== "") {
    const mps = swimPaceInputToMps(form.thresholdSwimPace);
    if (mps == null || mps < 0.4 || mps > 3) {
      errors.thresholdSwimPace = "Use m:ss per 100 m (e.g. 1:35)";
    } else {
      thresholdSwimPaceMps = mps;
    }
  }

  if (form.birthdate.trim() !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(form.birthdate)) {
    errors.birthdate = "Use YYYY-MM-DD";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    input: {
      sex: form.sex === "" ? undefined : form.sex,
      birthdate: form.birthdate.trim() === "" ? null : form.birthdate.trim(),
      heightCm: heightCm.ok ? heightCm.value : null,
      weightKg: weightKg.ok ? weightKg.value : null,
      restingHr: restingHr.ok ? restingHr.value : null,
      maxHr: maxHr.ok ? maxHr.value : null,
      lthr: lthr.ok ? lthr.value : null,
      ftp: ftp.ok ? ftp.value : null,
      thresholdPaceMps,
      thresholdSwimPaceMps,
    },
  };
}

function SourceBadge({ source }: { source: string | null | undefined }) {
  if (!source) {
    return null;
  }
  return (
    <Badge variant="outline" className="font-normal capitalize">
      {source}
    </Badge>
  );
}

export function AthleteProfileForm() {
  const queryClient = useQueryClient();
  const { data: profile, isLoading, isError } = useQuery(athleteProfileQueryOptions);
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [anchorsChanged, setAnchorsChanged] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setForm(profileToForm(profile));
    }
  }, [profile]);

  const save = useMutation({
    mutationFn: updateAthleteProfile,
    onSuccess: async (result) => {
      setErrors({});
      setSaveMessage("Profile saved");
      setAnchorsChanged(result.anchorsChanged);
      setForm(profileToForm(result));
      await queryClient.invalidateQueries({ queryKey: athleteProfileQueryKey });
      if (result.anchorsChanged) {
        await queryClient.invalidateQueries({ queryKey: dailyMetricsQueryKey });
      }
    },
    onError: () => {
      setSaveMessage(null);
      setErrors({ sex: "Could not save profile. Check values and try again." });
    },
  });

  const recompute = useMutation({
    mutationFn: () => recomputeMetrics({ scope: "all" }),
    onSuccess: async (summary) => {
      setAnchorsChanged(false);
      setSaveMessage(
        `Recomputed ${summary.processed} activities${summary.skipped > 0 ? ` (${summary.skipped} skipped)` : ""}`,
      );
      await queryClient.invalidateQueries({ queryKey: dailyMetricsQueryKey });
    },
    onError: () => {
      setSaveMessage("Metrics recompute failed");
    },
  });

  function updateField<K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaveMessage(null);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form) {
      return;
    }
    const payload = buildUpdatePayload(form);
    if (!payload.ok) {
      setErrors(payload.errors);
      return;
    }
    setErrors({});
    save.mutate(payload.input);
  }

  if (isLoading || !form) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Athlete profile</CardTitle>
          <CardDescription>Loading profile…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Athlete profile</CardTitle>
          <CardDescription className="text-destructive">Failed to load profile</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Athlete profile</CardTitle>
        <CardDescription>
          Body metrics and training anchors used for TSS, TRIMP, and daily fitness.
          {profile?.athleteCreatedAt && (
            <> Strava athlete since {new Date(profile.athleteCreatedAt).toLocaleDateString()}.</>
          )}
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="flex flex-col gap-6">
          {(profile?.bmi != null || profile?.bsa != null) && (
            <p className="text-muted-foreground text-xs">
              {profile.bmi != null && <>BMI {profile.bmi}</>}
              {profile.bmi != null && profile.bsa != null && " · "}
              {profile.bsa != null && <>BSA {profile.bsa} m²</>}
            </p>
          )}

          <FieldSet>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.sex || undefined}>
                <FieldLabel htmlFor="sex">Sex</FieldLabel>
                <NativeSelect
                  id="sex"
                  className="w-full"
                  value={form.sex}
                  onChange={(e) => updateField("sex", e.target.value as ProfileFormState["sex"])}
                >
                  <NativeSelectOption value="">Unset</NativeSelectOption>
                  <NativeSelectOption value="M">Male</NativeSelectOption>
                  <NativeSelectOption value="F">Female</NativeSelectOption>
                </NativeSelect>
                <FieldDescription>Used for Banister TRIMP sex coefficient.</FieldDescription>
                {errors.sex && <FieldError>{errors.sex}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.birthdate || undefined}>
                <FieldLabel htmlFor="birthdate">Birthdate</FieldLabel>
                <Input
                  id="birthdate"
                  type="date"
                  value={form.birthdate}
                  onChange={(e) => updateField("birthdate", e.target.value)}
                />
                {errors.birthdate && <FieldError>{errors.birthdate}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.heightCm || undefined}>
                <FieldLabel htmlFor="heightCm">Height (cm)</FieldLabel>
                <Input
                  id="heightCm"
                  inputMode="decimal"
                  value={form.heightCm}
                  onChange={(e) => updateField("heightCm", e.target.value)}
                  placeholder="178"
                />
                {errors.heightCm && <FieldError>{errors.heightCm}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.weightKg || undefined}>
                <FieldLabel htmlFor="weightKg">Weight (kg)</FieldLabel>
                <Input
                  id="weightKg"
                  inputMode="decimal"
                  value={form.weightKg}
                  onChange={(e) => updateField("weightKg", e.target.value)}
                  placeholder="72"
                />
                <FieldDescription>Changing weight appends a history sample.</FieldDescription>
                {errors.weightKg && <FieldError>{errors.weightKg}</FieldError>}
              </Field>
            </FieldGroup>
          </FieldSet>

          <FieldSet>
            <FieldGroup className="grid gap-4 sm:grid-cols-2">
              <Field data-invalid={!!errors.restingHr || undefined}>
                <FieldLabel htmlFor="restingHr">Resting HR (bpm)</FieldLabel>
                <Input
                  id="restingHr"
                  inputMode="numeric"
                  value={form.restingHr}
                  onChange={(e) => updateField("restingHr", e.target.value)}
                  placeholder="48"
                />
                {errors.restingHr && <FieldError>{errors.restingHr}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.maxHr || undefined}>
                <FieldLabel htmlFor="maxHr" className="flex items-center gap-2">
                  Max HR (bpm)
                  <SourceBadge source={profile?.maxHrSource} />
                </FieldLabel>
                <Input
                  id="maxHr"
                  inputMode="numeric"
                  value={form.maxHr}
                  onChange={(e) => updateField("maxHr", e.target.value)}
                  placeholder="190"
                />
                {errors.maxHr && <FieldError>{errors.maxHr}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.lthr || undefined}>
                <FieldLabel htmlFor="lthr" className="flex items-center gap-2">
                  LTHR (bpm)
                  <SourceBadge source={profile?.lthrSource} />
                </FieldLabel>
                <Input
                  id="lthr"
                  inputMode="numeric"
                  value={form.lthr}
                  onChange={(e) => updateField("lthr", e.target.value)}
                  placeholder="165"
                />
                <FieldDescription>Lactate threshold heart rate.</FieldDescription>
                {errors.lthr && <FieldError>{errors.lthr}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.ftp || undefined}>
                <FieldLabel htmlFor="ftp" className="flex items-center gap-2">
                  FTP (W)
                  <SourceBadge source={profile?.ftpSource} />
                </FieldLabel>
                <Input
                  id="ftp"
                  inputMode="numeric"
                  value={form.ftp}
                  onChange={(e) => updateField("ftp", e.target.value)}
                  placeholder="250"
                />
                {errors.ftp && <FieldError>{errors.ftp}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.thresholdRunPace || undefined}>
                <FieldLabel htmlFor="thresholdRunPace" className="flex items-center gap-2">
                  Threshold pace
                  <SourceBadge source={profile?.thresholdPaceSource} />
                </FieldLabel>
                <Input
                  id="thresholdRunPace"
                  value={form.thresholdRunPace}
                  onChange={(e) => updateField("thresholdRunPace", e.target.value)}
                  placeholder="4:30"
                />
                <FieldDescription>min:sec per km (running threshold).</FieldDescription>
                {errors.thresholdRunPace && <FieldError>{errors.thresholdRunPace}</FieldError>}
              </Field>

              <Field data-invalid={!!errors.thresholdSwimPace || undefined}>
                <FieldLabel htmlFor="thresholdSwimPace" className="flex items-center gap-2">
                  CSS (swim)
                  <SourceBadge source={profile?.thresholdSwimPaceSource} />
                </FieldLabel>
                <Input
                  id="thresholdSwimPace"
                  value={form.thresholdSwimPace}
                  onChange={(e) => updateField("thresholdSwimPace", e.target.value)}
                  placeholder="1:35"
                />
                <FieldDescription>Critical swim speed as min:sec per 100 m.</FieldDescription>
                {errors.thresholdSwimPace && <FieldError>{errors.thresholdSwimPace}</FieldError>}
              </Field>
            </FieldGroup>
          </FieldSet>

          {anchorsChanged && (
            <Alert>
              <AlertTitle>Anchors changed</AlertTitle>
              <AlertDescription>
                Recompute activity metrics so CTL / ATL / TSB and training load use the new values.
              </AlertDescription>
              <AlertAction>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={recompute.isPending}
                  onClick={() => recompute.mutate()}
                >
                  {recompute.isPending ? "Recomputing…" : "Recompute"}
                </Button>
              </AlertAction>
            </Alert>
          )}

          {saveMessage && <p className="text-muted-foreground text-xs">{saveMessage}</p>}
        </CardContent>
        <CardFooter className="border-t">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
