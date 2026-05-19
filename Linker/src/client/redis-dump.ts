import { ApiEndpoint, type RedisDumpResponse } from "../shared/api.ts";
import { apiGet } from "./api.ts";
import { modalCard } from "./dom.ts";
import { closeModal, openModal } from "./modals.ts";

export async function openRedisDumpModal(): Promise<void> {
  modalCard.innerHTML = `<p style="text-align:center;color:#555;font-size:0.85em">Chargement…</p>`;
  openModal();
  try {
    const data = await apiGet<RedisDumpResponse>(ApiEndpoint.RedisDump);
    if (data.type !== "redis-dump") {
      modalCard.innerHTML = `<p style="color:red">Réponse inattendue.</p>`;
      return;
    }
    const fmt = (raw: string | null): string => {
      if (raw === null) return "(non défini)";
      try {
        return JSON.stringify(JSON.parse(raw), null, 2);
      } catch {
        return raw;
      }
    };
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    modalCard.innerHTML = `
      <h3 class="form-title">Dump Redis</h3>
      <p style="font-size:0.75em;color:#555;margin-bottom:4px">Clé : <code>${esc(data.boardKey)}</code></p>
      <pre style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:8px;font-size:0.7em;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:#000">${esc(fmt(data.boardRaw))}</pre>
      <p style="font-size:0.75em;color:#555;margin:8px 0 4px">Clé : <code>${esc(data.whitelistKey)}</code></p>
      <pre style="background:#f5f5f5;border:1px solid #ddd;border-radius:4px;padding:8px;font-size:0.7em;max-height:60px;overflow:auto;white-space:pre-wrap;word-break:break-all;color:#000">${esc(fmt(data.whitelistRaw))}</pre>
      <div class="form-buttons">
        <button class="btn-cancel" id="dump-copy">Copier JSON board</button>
        <button class="btn-primary" id="dump-close">Fermer</button>
      </div>`;
    document.getElementById("dump-close")!.addEventListener("click", closeModal);
    document.getElementById("dump-copy")!.addEventListener("click", () => {
      navigator.clipboard.writeText(data.boardRaw ?? "").catch(() => undefined);
    });
  } catch {
    modalCard.innerHTML = `
      <p style="color:red">Échec du chargement. Êtes-vous modérateur ?</p>
      <div class="form-buttons"><button class="btn-primary" id="dump-close-err">Fermer</button></div>`;
    document.getElementById("dump-close-err")!.addEventListener("click", closeModal);
  }
}
