import type { SportFamily, SportModule } from "./types";

const modules = new Map<SportFamily, SportModule>();

/** Register a sport-specific compute module (wired in PR3/PR4). */
export function registerSportModule(module: SportModule): void {
  modules.set(module.family, module);
}

export function getSportModule(family: SportFamily): SportModule | undefined {
  return modules.get(family);
}

export function listSportModules(): SportModule[] {
  return [...modules.values()];
}
