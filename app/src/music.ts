import { NativeModules, Platform } from "react-native";

type MusicModule = {
  hasAccess(): Promise<boolean>;
  send(action: "next" | "prev" | "playpause"): Promise<boolean>;
  openSettings(): void;
};

const mod: MusicModule | undefined =
  Platform.OS === "android" ? NativeModules.MusicControl : undefined;

export async function hasMusicAccess(): Promise<boolean> {
  try {
    return mod ? await mod.hasAccess() : false;
  } catch {
    return false;
  }
}

export async function sendMusic(action: "next" | "prev" | "playpause"): Promise<boolean> {
  try {
    return mod ? await mod.send(action) : false;
  } catch {
    return false;
  }
}

export function openMusicSettings() {
  mod?.openSettings();
}
