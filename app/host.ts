// The one host surface the launcher uses. Both the device runtime and the
// desktop bridge expose it as `globalThis.ui.__launcher`; a host that lacks it
// simply answers nothing, which every caller turns into "--".
export interface LauncherHost {
  __launcher?: (command: string) => string;
}

export const launcherHost = (): LauncherHost | undefined =>
  (globalThis as typeof globalThis & { ui?: LauncherHost }).ui;
