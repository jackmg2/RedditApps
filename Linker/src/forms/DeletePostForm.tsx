import { Devvit, useForm } from '@devvit/public-api';

interface DeletePostFormProps {
  onDeletePost: () => Promise<void>;
}

/**
 * Form component for confirming post deletion
 */
export const useDeletePostForm = ({ onDeletePost }: DeletePostFormProps) => {
  return useForm(() => {
    return {
      fields: [        
        {
          name: 'confirmText',
          label: 'Type "DELETE" to confirm',
          type: 'string',
          defaultValue: '',
          helpText: 'This ensures you really want to delete this post',
          onValidate: (e: any) => {
            if (e.value !== 'DELETE') {
              return 'Please type DELETE in all caps to confirm';
            }
            return undefined;
          }
        }
      ],
      title: '🗑️ Delete Community Links Post',
      acceptLabel: 'Delete Permanently',
      cancelLabel: 'Cancel'
    } as const;
  },
  async (formData) => {
    // Double-check the confirmation values
    if (formData.confirmText === 'DELETE') {
      await onDeletePost();
    }
  });
};