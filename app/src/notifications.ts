import { NativeModules, Platform } from "react-native";

export type AppNotification = {
  key: string;
  app: string;
  title: string;
  text: string;
  time: number;
};

type Mod = {
  getNotifications(): Promise<string>;
  clearNotifications(): void;
};

const mod: Mod | undefined =
  Platform.OS === "android" ? NativeModules.MusicControl : undefined;

export async function getNotifications(): Promise<AppNotification[]> {
  if (!mod) return [];
  try {
    const raw: string = await mod.getNotifications();
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function clearNotifications() {
  mod?.clearNotifications();
}
