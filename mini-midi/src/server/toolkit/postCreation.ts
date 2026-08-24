// Copied from _shared/toolkit — do not edit in the app.
// Edit c:\Dev\02_RedditApps\_shared\toolkit and run: node ../_shared/sync-toolkit.mjs sync --all
//
// Rules 2 & 3: posts are created from a mod/menu action (never onAppInstall),
// and the user must be prompted for the title. buildTitlePromptForm returns
// the menu handler's UiResponse; extractTitle reads the form submit payload.

export type TitlePromptOptions = {
  /** Must match a form name registered in devvit.json "forms". */
  formName: string;
  formTitle: string;
  defaultTitle: string;
  helpText?: string;
  acceptLabel?: string;
  /** Extra form fields appended after the title field. */
  extraFields?: unknown[];
};

type TitlePromptForm = {
  showForm: {
    name: string;
    form: {
      title: string;
      fields: unknown[];
      acceptLabel: string;
    };
  };
};

/** UiResponse for a menu handler: a form with one required `title` field. */
export function buildTitlePromptForm(opts: TitlePromptOptions): TitlePromptForm {
  return {
    showForm: {
      name: opts.formName,
      form: {
        title: opts.formTitle,
        fields: [
          {
            type: "string",
            name: "title",
            label: "Post title",
            defaultValue: opts.defaultTitle,
            helpText: opts.helpText,
            required: true,
          },
          ...(opts.extraFields ?? []),
        ],
        acceptLabel: opts.acceptLabel ?? "Create",
      },
    },
  };
}

/**
 * Reads the title from a form-submit payload. Handles the shapes seen across
 * the apps: { title } | { values: { title } } | { results: { title: { stringValue } } }.
 */
export function extractTitle(body: unknown, fallback: string): string {
  const b = body as
    | {
        title?: unknown;
        values?: { title?: unknown };
        results?: { title?: { stringValue?: unknown } };
      }
    | null
    | undefined;

  const candidate = b?.title ?? b?.values?.title ?? b?.results?.title?.stringValue;
  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }
  return fallback;
}
