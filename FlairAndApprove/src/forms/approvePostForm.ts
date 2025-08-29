import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { ApprovalService } from '../services/approvalService.js';

export const onApprovePostHandler = async (
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
) => {
  await ApprovalService.processApproval(event.values, context);
};

export const modalApprovePost = Devvit.createForm((data) => ({
  title: `Approve and apply flair to ${data.username}`,
  fields: [
    {
      name: 'subRedditName',
      label: 'SubReddit',
      type: 'string',
      disabled: true,
      defaultValue: data.subRedditName
    },
    {
      name: 'username',
      label: 'Username',
      type: 'string',
      disabled: true,
      defaultValue: data.username
    },
    {
      name: 'postId',
      label: 'Post Id',
      type: 'string',
      disabled: true,
      defaultValue: data.postId
    },
    {
      name: 'selectedFlair',
      type: 'select',
      label: 'Flair',
      options: data.flairTemplates,
      defaultValue: data.defaultFlair,
      multiSelect: false
    },
    {
      name: 'comment',
      type: 'paragraph',
      label: 'Comment',
      defaultValue: data.defaultComment
    },
    {
      name: 'approveUser',
      type: 'boolean',
      label: 'Approve user',
      defaultValue: data.defaultValueApproveUser
    },
    {
      name: 'approvePost',
      type: 'boolean',
      label: 'Approve post',
      defaultValue: data.defaultValueApprovePost
    }
  ],
  acceptLabel: 'Submit',
  cancelLabel: 'Cancel',
}), onApprovePostHandler);