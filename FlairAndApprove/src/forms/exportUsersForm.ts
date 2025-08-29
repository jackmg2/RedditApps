import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';

export const onExportUsersHandler = async (
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
) => {
  // No action needed on submit, just close the form
  context.ui.showToast('Approved users list displayed');
};

export const modalExportApprovedUsers = Devvit.createForm((data) => ({
  title: `Approved Users (${data.total} total)`,
  fields: [
    {
      name: 'approvedUsersList',
      label: 'Approved Users List',
      type: 'paragraph',
      helpText: 'Copy this semicolon-separated list of approved users',
      defaultValue: data.userList,
      disabled: false
    }
  ],
  acceptLabel: 'Done',
  cancelLabel: 'Close',
}), onExportUsersHandler);