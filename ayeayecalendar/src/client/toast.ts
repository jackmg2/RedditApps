import { toastEl } from "./dom.ts";

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, isError = false): void {
  if (toastTimer !== null) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  toastEl.textContent = message;
  toastEl.classList.remove("hidden", "error");
  if (isError) toastEl.classList.add("error");
  toastTimer = setTimeout(() => {
    toastEl.classList.add("hidden");
    toastTimer = null;
  }, 3000);
}
