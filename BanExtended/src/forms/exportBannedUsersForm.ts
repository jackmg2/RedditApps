import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';

export const onExportBannedUsersHandler = async (
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
) => {
  context.ui.showToast('Banned users list displayed');
};

export const modalExportBannedUsers = Devvit.createForm((data) => ({
  title: `Banned Users (${data.total} total)`,
  fields: [
    {
      name: 'bannedUsersList',
      label: 'Banned Users List',
      type: 'paragraph',
      helpText: 'Copy this semicolon-separated list of banned users',
      defaultValue: data.userList,
      disabled: false
    }
  ],
  acceptLabel: 'Done',
  cancelLabel: 'Close',
}), onExportBannedUsersHandler);