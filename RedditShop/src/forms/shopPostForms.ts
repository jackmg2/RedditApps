import { FormField } from "@devvit/public-api";

// Predefined color options for easy selection
const COLOR_OPTIONS = [
  { label: 'Dark Gray (Default)', value: '#2b2321EE' },  
  { label: 'White', value: '#FFFFFFEE' },
  { label: 'Red', value: '#FFADADEE' },
  { label: 'Orange', value: '#FFD6A5EE' },
  { label: 'Yellow', value: '#FDFFB6EE' },
  { label: 'Green', value: '#E4F1EEEE' },
  { label: 'Blue-Green', value: '#D9EDF8EE' },
  { label: 'Blue', value: '#DEDAF4EE' },
  { label: 'Custom', value: 'custom' }
];

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
        name: 'color',
        label: 'Pin Color',
        type: 'select',
        options: COLOR_OPTIONS,
        defaultValue: COLOR_OPTIONS[0].value,
        helpText: 'Choose a color for the pin. Select "Custom" to enter a hex color code.',
        required: true
      },
      {
        name: 'customColor',
        label: 'Custom Color (if selected above)',
        type: 'string',
        helpText: 'Enter a hex color code (e.g., #FF0000FF for red with transparency). Only used if "Custom" is selected above.'
      },
      {
        name: 'x',
        label: `X Position (${position.x.toFixed(1)}%)`,
        type: 'string',
        defaultValue: position.x.toFixed(1),
        helpText: 'Horizontal position on image (0-100, decimals allowed, e.g. 25.5)',
        required: true
      },
      {
        name: 'y',
        label: `Y Position (${position.y.toFixed(1)}%)`,
        type: 'string',
        defaultValue: position.y.toFixed(1),
        helpText: 'Vertical position on image (0-100, decimals allowed, e.g. 75.2)',
        required: true
      }
    ] as readonly FormField[],
    title: 'Add Shopping Pin',
    acceptLabel: 'Add Pin',
  };
};

export const createEditPinForm = (pinData: {
  id: string;
  title: string;
  link: string;
  x: number;
  y: number;
  color?: string | string[];
  createdAt: string;
}) => {
  // Normalize color - handle both string and array inputs
  let currentColor = '#2b2321EE';
  if (pinData.color) {
    if (Array.isArray(pinData.color)) {
      currentColor = pinData.color[0] || '#2b2321EE';
    } else if (typeof pinData.color === 'string') {
      currentColor = pinData.color;
    }
  }

  // Check if current color is in our predefined options
  const isCustomColor = !COLOR_OPTIONS.some(option => option.value === currentColor && option.value !== 'custom');

  return {
    fields: [
      {
        name: 'pinId',
        label: 'Pin ID (Internal)',
        type: 'string',
        defaultValue: pinData.id,
        helpText: 'Internal ID for the pin being edited',
        disabled: true,
        required: true
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
        name: 'color',
        label: 'Pin Color',
        type: 'select',
        options: COLOR_OPTIONS,
        defaultValue: isCustomColor ? ['custom'] : [currentColor],
        helpText: 'Choose a color for the pin. Select "Custom" to enter a hex color code.',
        required: true
      },
      {
        name: 'customColor',
        label: 'Custom Color (if selected above)',
        type: 'string',
        defaultValue: isCustomColor ? currentColor : '',
        helpText: 'Enter a hex color code (e.g., #FF0000FF for red with transparency). Only used if "Custom" is selected above.'
      },
      {
        name: 'x',
        label: `X Position (${pinData.x.toFixed(1)}%)`,
        type: 'string',
        defaultValue: pinData.x.toFixed(1),
        helpText: 'Horizontal position on image (0-100, decimals allowed, e.g. 25.5)',
        required: true
      },
      {
        name: 'y',
        label: `Y Position (${pinData.y.toFixed(1)}%)`,
        type: 'string',
        defaultValue: pinData.y.toFixed(1),
        helpText: 'Vertical position on image (0-100, decimals allowed, e.g. 75.2)',
        required: true
      }
    ] as readonly FormField[],
    title: 'Edit Shopping Pin',
    acceptLabel: 'Update Pin',
  };
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
        helpText: 'Enter the width in pixels (e.g., 800). Leave blank for default (800).'
      },
      {
        name: 'height',
        label: 'Image Height (optional)',
        type: 'string',
        helpText: 'Enter the height in pixels (e.g., 600). Leave blank for default (600).'
      }
    ],
    title: 'Add Image',
    acceptLabel: 'Add Image',
  };
};