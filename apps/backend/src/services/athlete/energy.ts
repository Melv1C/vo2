/**
 * Estimates cycling energy expenditure from mechanical work.
 * Uses the kJ ≈ kcal convention: gross metabolic energy ≈ mechanical work when
 * ~24% gross efficiency cancels the 4.184 J/cal conversion.
 * Source: Coggan / TrainingPeaks convention (not ACSM — power-based, not pace-based).
 *
 * @param workKj - Mechanical work in kilojoules (∫ power × Δt)
 * @returns Energy in kilocalories
 */
export function cyclingEnergyKcalFromWorkKj(workKj: number): number {
  return workKj;
}

/**
 * Estimates running energy expenditure from NGP.
 * VO2 (ml/kg/min) = 0.2 × speed(m/min) + 3.5; kcal from VO2 via 5 kcal/L O2.
 * Source: ACSM metabolic equations.
 *
 * @param ngpMps - Normalized grade-adjusted pace (m/s)
 * @param weightKg - Athlete weight (kg)
 * @param durationS - Moving duration (seconds)
 * @returns Energy in kilocalories
 */
export function acsmRunningEnergyKcal(ngpMps: number, weightKg: number, durationS: number): number {
  const speedMpm = ngpMps * 60;
  const vo2MlKgMin = 0.2 * speedMpm + 3.5;
  const durationMin = durationS / 60;
  return ((vo2MlKgMin * weightKg * durationMin) / 1000) * 5;
}

/**
 * Estimates swimming energy expenditure from normalized swim pace.
 * VO2 (ml/kg/min) = 1.8 × speed(m/min) + 3.5 for front crawl.
 * Source: ACSM metabolic equations for swimming.
 */
export function acsmSwimmingEnergyKcal(
  nspMps: number,
  weightKg: number,
  durationS: number,
): number {
  const speedMpm = nspMps * 60;
  const vo2MlKgMin = 1.8 * speedMpm + 3.5;
  const durationMin = durationS / 60;
  return ((vo2MlKgMin * weightKg * durationMin) / 1000) * 5;
}
