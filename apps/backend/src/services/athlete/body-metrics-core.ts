export type WeightSample = {
  value: number;
  recordedAt: Date;
};

/** Du Bois body surface area (m²). */
export function computeBsa(weightKg: number, heightCm: number): number {
  return 0.007184 * weightKg ** 0.425 * heightCm ** 0.725;
}

export function computeBmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/** Latest sample on or before `at`; falls back to profile weight when no history exists. */
export function resolveWeightAtDate(
  samples: WeightSample[],
  profileWeightKg: number | null,
  at: Date,
): number | null {
  const eligible = samples
    .filter((sample) => sample.recordedAt.getTime() <= at.getTime())
    .sort((a, b) => b.recordedAt.getTime() - a.recordedAt.getTime());

  if (eligible.length > 0) {
    return eligible[0]!.value;
  }

  return profileWeightKg;
}
