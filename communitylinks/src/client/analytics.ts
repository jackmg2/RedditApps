import { ApiEndpoint, type AnalyticsResponse } from "../shared/api.ts";
import { apiGet } from "./api.ts";
import { modalBody } from "./dom.ts";
import { escHtml } from "./helpers.ts";
import { closeModal, openModal } from "./modals.ts";

export async function openAnalyticsModal(): Promise<void> {
  openModal("Analytics");
  modalBody.innerHTML = `<p style="text-align:center;color:#8b949e;font-size:0.85em">Loading analytics…</p>`;

  try {
    const data = await apiGet<AnalyticsResponse>(ApiEndpoint.Analytics);
    if (data.type !== "analytics") {
      modalBody.innerHTML = `<p style="color:#f85149">Failed to load analytics.</p>`;
      return;
    }

    const { data: analytics, abTests } = data;
    const fmt = (n: number) => n.toFixed(1);

    modalBody.innerHTML = `
      <div class="tab-bar">
        <button class="tab-btn active" data-tab="overview">Overview</button>
        <button class="tab-btn" data-tab="abtests">A/B Tests</button>
        <button class="tab-btn" data-tab="pages">Pages</button>
      </div>

      <!-- Overview tab -->
      <div class="tab-panel active" id="tab-overview">
        <div class="analytics-row"><span class="analytics-label">Total Clicks</span><span class="analytics-value">${analytics.totalClicks}</span></div>
        <div class="analytics-row"><span class="analytics-label">Total Impressions</span><span class="analytics-value">${analytics.totalImpressions}</span></div>
        <div class="analytics-row"><span class="analytics-label">Overall CTR</span><span class="analytics-value">${fmt(analytics.ctr)}%</span></div>
        <div class="analytics-row"><span class="analytics-label">Active A/B Tests</span><span class="analytics-value">${analytics.activeABTests}</span></div>
        ${analytics.mostClickedPageTitle ? `<div class="analytics-row"><span class="analytics-label">Most Clicked Page</span><span class="analytics-value">${escHtml(analytics.mostClickedPageTitle)}</span></div>` : ""}
      </div>

      <!-- A/B Tests tab -->
      <div class="tab-panel" id="tab-abtests">
        ${abTests.length === 0 ? '<p style="color:#8b949e;font-size:0.85em;padding:8px 0">No active A/B tests.</p>' : abTests.map((test) => `
          <div class="ab-test-item">
            ${test.isSignificant ? '<span class="significant-badge">Significant</span>' : ""}
            ${test.variants.map((v) => `
              <div class="ab-variant-row ${v.isBest ? "best" : ""}">
                <span>${escHtml(v.title) || "(untitled)"}</span>
                <span>${v.clicks} clicks / ${fmt(v.ctr)}% CTR</span>
              </div>`).join("")}
          </div>`).join("")}
      </div>

      <!-- Pages tab -->
      <div class="tab-panel" id="tab-pages">
        ${analytics.pages.map((p) => `
          <div style="margin-bottom:10px">
            <strong style="font-size:0.85em">${escHtml(p.title)}</strong>
            <div class="analytics-row"><span class="analytics-label">Clicks</span><span class="analytics-value">${p.totalClicks}</span></div>
            <div class="analytics-row"><span class="analytics-label">Impressions</span><span class="analytics-value">${p.totalImpressions}</span></div>
            <div class="analytics-row"><span class="analytics-label">CTR</span><span class="analytics-value">${fmt(p.ctr)}%</span></div>
            <div class="analytics-row"><span class="analytics-label">Active Cells</span><span class="analytics-value">${p.activeCellCount}</span></div>
          </div>`).join("")}
      </div>

      <div class="form-buttons">
        <button class="btn-primary" id="analytics-close">Close</button>
      </div>`;

    document.getElementById("analytics-close")!.addEventListener("click", closeModal);

    modalBody.querySelectorAll<HTMLButtonElement>(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        modalBody.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        modalBody.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        const tabId = `tab-${btn.dataset.tab}`;
        document.getElementById(tabId)?.classList.add("active");
      });
    });
  } catch {
    modalBody.innerHTML = `<p style="color:#f85149">Failed to load analytics.</p>`;
  }
}
