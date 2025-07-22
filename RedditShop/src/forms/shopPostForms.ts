export const createAddPinForm = (position: { x: number, y: number }) => {
  return {
    fields: [
      {
        name: 'title',
        label: 'Product Title',
        type: 'string',
        required: true,
        helpText: 'Enter the product name or title'
      },
      {
        name: 'link',
        label: 'Product Link',
        type: 'string',
        required: true,
        helpText: 'Enter the URL to the product (must start with https://)'
      },
      {
        name: 'x',
        label: `X Position (${position.x.toFixed(1)}%)`,
        type: 'string',
        defaultValue: position.x.toFixed(1),
        helpText: 'Horizontal position on image (0-100, decimals allowed, e.g. 25.5)'
      },
      {
        name: 'y',
        label: `Y Position (${position.y.toFixed(1)}%)`,
        type: 'string',
        defaultValue: position.y.toFixed(1),
        helpText: 'Vertical position on image (0-100, decimals allowed, e.g. 75.2)'
      }
    ],
    title: 'Add Shopping Pin',
    acceptLabel: 'Add Pin',
  } as const;
};

export const createEditPinForm = (pinData: {
  id: string;
  title: string;
  link: string;
  x: number;
  y: number;
  createdAt: string;
}) => {
  return {
    fields: [
      {
        name: 'pinId',
        label: 'Pin ID (Internal)',
        type: 'string',
        defaultValue: pinData.id,
        helpText: 'Internal ID for the pin being edited',
        disabled: true
      },
      {
        name: 'title',
        label: 'Product Title',
        type: 'string',
        required: true,
        defaultValue: pinData.title,
        helpText: 'Enter the product name or title'
      },
      {
        name: 'link',
        label: 'Product Link',
        type: 'string',
        required: true,
        defaultValue: pinData.link,
        helpText: 'Enter the URL to the product (must start with https://)'
      },
      {
        name: 'x',
        label: `X Position (${pinData.x.toFixed(1)}%)`,
        type: 'string',
        defaultValue: pinData.x.toFixed(1),
        helpText: 'Horizontal position on image (0-100, decimals allowed, e.g. 25.5)'
      },
      {
        name: 'y',
        label: `Y Position (${pinData.y.toFixed(1)}%)`,
        type: 'string',
        defaultValue: pinData.y.toFixed(1),
        helpText: 'Vertical position on image (0-100, decimals allowed, e.g. 75.2)'
      }
    ],
    title: 'Edit Shopping Pin',
    acceptLabel: 'Update Pin',
  } as const;
};

export const createAddImageForm = () => {
  return {
    fields: [
      {
        name: 'image',
        label: 'Product Image',
        type: 'image',
        required: true,
        helpText: 'Upload an additional image to add shopping pins to'
      },
      {
        name: 'width',
        label: 'Image Width (optional)',
        type: 'string',
        helpText: 'Enter the width in pixels (e.g., 800). Leave blank for default.'
      },
      {
        name: 'height',
        label: 'Image Height (optional)',
        type: 'string',
        helpText: 'Enter the height in pixels (e.g., 600). Leave blank for default.'
      }
    ],
    title: 'Add Image',
    acceptLabel: 'Add Image',
  };
};