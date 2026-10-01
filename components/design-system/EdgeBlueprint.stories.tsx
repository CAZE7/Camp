import type { Meta, StoryObj } from '@storybook/react';
import { EdgeBlueprint } from './EdgeBlueprint';

const meta: Meta<typeof EdgeBlueprint> = {
  title: 'Dark Engineering/Edges & Trassen',
  component: EdgeBlueprint,
  parameters: {
    layout: 'centered',
    backgrounds: { default: 'canvas', values: [{ name: 'canvas', value: 'var(--de-surface-0)' }] },
    chromatic: { diffThreshold: 0.02 },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EdgeBlueprint>;

export const Hierarchy: Story = {
  render: () => <EdgeBlueprint />,
  parameters: {
    docs: {
      description: {
        story:
          'Modul 2: MAIN 3px + Glow, BRANCH 2px, CAN/SENSOR 1.5px/1.25px dashed filigran, Bridge non-scaling-stroke, PE Stripes DIN',
      },
    },
  },
};

export const NonScalingStroke: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <svg width="200" height="40" className="overflow-visible">
        <line
          x1="0"
          y1="20"
          x2="200"
          y2="20"
          stroke="var(--de-wire-dc-12v-plus)"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ vectorEffect: 'non-scaling-stroke' }}
        />
      </svg>
      <span className="font-mono text-[11px]">
        vector-effect: non-scaling-stroke — bleibt 3px bei jedem Zoom, kein Pixelmatsch
      </span>
      <span className="font-mono text-[10px] text-[var(--de-text-dim)]">
        Modul 5: Null-Toleranz visuelle Regression
      </span>
    </div>
  ),
};

export const PEStripes: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <div className="h-6 w-[200px] rounded-[2px]" style={{ background: 'var(--de-wire-ac-pe-striped)' }} />
      <span className="font-mono text-[11px]">PE DIN VDE 0100 Grün/Gelb gestreift — zusätzlich ▲ Form</span>
    </div>
  ),
};
