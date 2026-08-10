/** ACSM running metabolic estimate from grade-adjusted speed. */
export function acsmRunningEnergyKcal(ngpMps: number, weightKg: number, durationS: number): number {
  const speedMpm = ngpMps * 60;
  const vo2MlKgMin = 0.2 * speedMpm + 3.5;
  const durationMin = durationS / 60;
  return ((vo2MlKgMin * weightKg * durationMin) / 1000) * 5;
}
