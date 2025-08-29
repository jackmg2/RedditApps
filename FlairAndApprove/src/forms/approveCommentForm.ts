import { Devvit, FormOnSubmitEvent, JSONObject } from '@devvit/public-api';
import { ApprovalService } from '../services/approvalService.js';

export const onApproveCommentHandler = async (
  event: FormOnSubmitEvent<JSONObject>,
  context: Devvit.Context
) => {
  await ApprovalService.processApproval(event.values, context);
};

export const modalApproveComment = Devvit.createForm((data) => ({
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
      name: 'commentId',
      label: 'Comment Id',
      type: 'string',
      disabled: true,
      defaultValue: data.commentId
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
      name: 'approveComment',
      type: 'boolean',
      label: 'Approve comment',
      defaultValue: data.defaultValueApproveComment
    }
  ],
  acceptLabel: 'Submit',
  cancelLabel: 'Cancel',
}), onApproveCommentHandler);