// Shared tilt store — one deviceorientation listener for the whole app,
// read every physics tick by whichever scene is mounted (balls steer the
// gravity vector, the slackliner reads roll to walk).
//
// Tilt is deliberately OPT-IN PER VISIT: no localStorage remembers it. The
// earlier flow persisted a one-time hint flag, and reads of it were
// unreliable (iOS wipes/segments storage across modes), so tilt enabled on
// some loads and not others. A visible button the user taps each time is
// honest about state and impossible to get out of sync.

export interface TiltStatus {
  /** true while the sensor listener is attached and driving scenes */
  enabled: boolean;
  /** normalized gravity from beta/gamma: upright ≈ {x:0, y:1} */
  gx: number;
  gy: number;
}

export const tiltState: TiltStatus = { enabled: false, gx: 0, gy: 1 };

export type TiltUiState = "off" | "on" | "denied" | "nodata";

// eslint-disable-next-line no-unused-vars
type Listener = (s: TiltUiState) => void;
let uiState: TiltUiState = "off";
const listeners = new Set<Listener>();

export function getTiltUi(): TiltUiState {
  return uiState;
}

export function subscribeTiltUi(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function setUi(next: TiltUiState) {
  if (uiState === next) return;
  uiState = next;
  listeners.forEach((fn) => fn(next));
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

let sawOrientation = false;
let nodataTimer = 0;

function onOrientation(e: DeviceOrientationEvent) {
  sawOrientation = true;
  if (e.beta == null || e.gamma == null) return;
  // Held upright: beta ≈ 90 (face-up→down axis), gamma ≈ 0 (left→right).
  tiltState.gx = clamp(e.gamma / 90, -1, 1);
  tiltState.gy = clamp(e.beta / 90, -1, 1);
}

function attach(watchForData: boolean) {
  if (tiltState.enabled) return;
  sawOrientation = false;
  tiltState.enabled = true;
  window.addEventListener("deviceorientation", onOrientation);
  setUi("on");
  if (watchForData) {
    // 'granted' but silence for a while means the per-site Safari
    // Motion & Orientation toggle is off — say so instead of drifting.
    window.clearTimeout(nodataTimer);
    nodataTimer = window.setTimeout(() => {
      if (!sawOrientation) setUi("nodata");
    }, 2500);
  }
}

/**
 * Enable tilt. Must be called from a user gesture on iOS (requestPermission
 * requirement). cb(retriedLater=true) when the event didn't qualify as a
 * gesture and a second tap should be invited.
 */
// eslint-disable-next-line no-unused-vars
export function requestTilt(onDone: (ok: boolean) => void): void {
  const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
    .DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === "function") {
    let p: Promise<string>;
    try {
      p = DOE.requestPermission();
    } catch {
      onDone(false); // not a qualifying gesture — the button stays, tap again
      return;
    }
    Promise.resolve(p).then(
      (res) => {
        if (res === "granted") {
          attach(true);
          onDone(true);
        } else {
          // iOS won't prompt again for this site; the button label guides out.
          setUi("denied");
          onDone(true);
        }
      },
      () => onDone(false),
    );
  } else {
    // Android / non-gated: no permission dialog to lose.
    attach(false);
    onDone(true);
  }
}

export function disableTilt(): void {
  if (!tiltState.enabled) {
    setUi("off");
    return;
  }
  tiltState.enabled = false;
  tiltState.gx = 0;
  tiltState.gy = 1;
  window.removeEventListener("deviceorientation", onOrientation);
  window.clearTimeout(nodataTimer);
  setUi("off");
}

export function isTouchDevice(): boolean {
  return (
    "ontouchstart" in window ||
    (navigator.maxTouchPoints ?? 0) > 0 ||
    (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches)
  );
}
