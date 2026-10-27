"use client";

export type PushState =
  | "unsupported"
  /** iOS Safari outside the home screen app: push only works once installed. */
  | "needs-install"
  | "denied"
  | "off"
  | "on";

export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function registerServiceWorker(): Promise<ServiceWorkerRegistration> | null {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

export async function currentPushState(): Promise<{
  state: PushState;
  subscription: PushSubscription | null;
}> {
  const supported =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) {
    return { state: isIOS() && !isStandalone() ? "needs-install" : "unsupported", subscription: null };
  }
  if (Notification.permission === "denied") return { state: "denied", subscription: null };
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return { state: subscription ? "on" : "off", subscription };
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function subscribePush(): Promise<PushSubscription | null> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key),
  });
}

export function subscriptionKeys(sub: PushSubscription) {
  const json = sub.toJSON();
  return {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
  };
}
