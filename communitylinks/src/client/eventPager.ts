type EventSection = {
  title: string;
  cards: HTMLElement[];
};

type EventRow = {
  heading: HTMLElement;
  card: HTMLElement;
};

type EventPage = {
  start: number;
  end: number;
  oversized: boolean;
};

export function createEventPager(container: HTMLElement, buttonClass: string) {
  const list = document.createElement("div");
  list.className = "calendar-event-list";
  list.id = "calendar-event-list";

  const nav = document.createElement("nav");
  nav.className = "calendar-event-nav";
  nav.ariaLabel = "Calendar event pages";
  nav.hidden = true;

  const previous = document.createElement("button");
  previous.type = "button";
  previous.className = buttonClass;
  previous.textContent = "Previous";
  previous.ariaLabel = "Previous events";
  previous.setAttribute("aria-controls", list.id);

  const status = document.createElement("span");
  status.setAttribute("role", "status");

  const next = document.createElement("button");
  next.type = "button";
  next.className = buttonClass;
  next.textContent = "Next";
  next.ariaLabel = "Next events";
  next.setAttribute("aria-controls", list.id);

  nav.append(previous, status, next);
  container.append(list, nav);

  let rows: EventRow[] = [];
  let pages: EventPage[] = [];
  let pageIndex = 0;
  let firstVisible = 0;
  let calendarId: string | undefined;

  function pageNodes(start: number, end: number): HTMLElement[] {
    const nodes: HTMLElement[] = [];
    let heading: HTMLElement | undefined;
    for (const row of rows.slice(start, end)) {
      if (row.heading !== heading) {
        heading = row.heading;
        nodes.push(heading);
      }
      nodes.push(row.card);
    }
    return nodes;
  }

  function showPage(): void {
    const page = pages[pageIndex];
    if (!page) return;

    firstVisible = page.start;
    list.classList.toggle("oversized", page.oversized);
    list.replaceChildren(...pageNodes(page.start, page.end));
    previous.disabled = pageIndex === 0;
    next.disabled = pageIndex === pages.length - 1;
    status.textContent = `${page.start + 1}–${page.end} of ${rows.length}`;
  }

  function measure(): void {
    if (rows.length === 0 || container.clientHeight === 0) return;

    const anchor = Math.min(firstVisible, rows.length - 1);
    list.classList.remove("oversized");
    list.replaceChildren(...pageNodes(0, rows.length));
    const gap = parseFloat(getComputedStyle(list).rowGap);
    const heights = new Map(
      Array.from(list.children, (child) => [child, child.getBoundingClientRect().height]),
    );
    const fullHeight = Array.from(heights.values()).reduce((sum, height) => sum + height, 0)
      + gap * (heights.size - 1);
    // The list can use the entire container when navigation is hidden.
    nav.hidden = rows.length === 1 || fullHeight <= container.getBoundingClientRect().height;

    const availableHeight = list.getBoundingClientRect().height;
    pages = [];
    let start = 0;
    let height = 0;
    for (const [index, row] of rows.entries()) {
      const headingHeight = heights.get(row.heading)! + gap;
      const cardHeight = heights.get(row.card)!;
      const startsSection = index === start || row.heading !== rows[index - 1]?.heading;
      const candidate = height + (index === start ? 0 : gap)
        + (startsSection ? headingHeight : 0) + cardHeight;
      if (index > start && candidate > availableHeight) {
        pages.push({ start, end: index, oversized: height > availableHeight });
        start = index;
        height = headingHeight + cardHeight;
      } else {
        height = candidate;
      }
    }
    pages.push({ start, end: rows.length, oversized: height > availableHeight });
    pageIndex = pages.findIndex((page) => anchor < page.end);
    showPage();
  }

  function move(delta: number, button: HTMLButtonElement, fallback: HTMLButtonElement): void {
    const destination = pageIndex + delta;
    if (destination < 0 || destination >= pages.length) return;
    const hadFocus = document.activeElement === button;
    pageIndex = destination;
    showPage();
    if (hadFocus && button.disabled) fallback.focus();
  }

  previous.addEventListener("click", () => move(-1, previous, next));
  next.addEventListener("click", () => move(1, next, previous));
  new ResizeObserver(measure).observe(container);

  return {
    setSections(sections: EventSection[], id?: string): void {
      if (id !== calendarId) {
        calendarId = id;
        firstVisible = 0;
      }

      rows = sections.flatMap(({ title, cards }) => {
        const heading = document.createElement("div");
        heading.className = "calendar-event-section";
        heading.textContent = title;
        return cards.map((card) => ({ heading, card }));
      });

      if (rows.length === 0) {
        firstVisible = 0;
        pages = [];
        list.replaceChildren();
        nav.hidden = true;
        return;
      }
      measure();
    },
  };
}
