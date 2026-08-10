import type { SportFamily, SportModule, UniversalModule } from "./types";

const modules = new Map<SportFamily, SportModule>();
let universal: UniversalModule | null = null;

/** Register a sport-specific compute module (wired in PR4). */
export function registerSportModule(module: SportModule): void {
  modules.set(module.family, module);
}

export function registerUniversalModule(module: UniversalModule): void {
  universal = module;
}

export function getUniversalModule(): UniversalModule {
  if (!universal) {
    throw new Error("Universal metrics module is not registered");
  }
  return universal;
}

export function getSportModule(family: SportFamily): SportModule | undefined {
  return modules.get(family);
}

export function listSportModules(): SportModule[] {
  return [...modules.values()];
}
