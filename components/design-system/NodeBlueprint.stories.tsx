import type { Meta, StoryObj } from '@storybook/react';
import {
  NodeBlueprint,
  BatteryNodeExample,
  InverterNodeExample,
  NODE_STATES,
  NODE_STATE_CLASSES,
} from './NodeBlueprint';

/**
 * Storybook CSF — Dark Engineering Node-Card
 * Modul 2: EDA/CAD Ergonomie, 9-State Matrix, DIN-Symbolik, 44px Hit-Targets
 * Governance: Jeder State muss visuell getestet werden (visual-de.spec.ts)
 */

const meta: Meta<typeof NodeBlueprint> = {
  title: 'Dark Engineering/Node Card',
  component: NodeBlueprint,
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'canvas',
      values: [
        { name: 'canvas', value: 'var(--de-surface-0)' },
        { name: 'panel', value: 'var(--de-surface-1)' },
      ],
    },
    // Visual Regression: Chromatic / Percy
    chromatic: { diffThreshold: 0.02 },
  },
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: ['ready', 'warning', 'error', 'offline'],
      description: 'Betriebsstatus — 8px Dot + 2px Leiste',
    },
    typeCode: {
      control: 'text',
      description: 'DIN-Code BAT/FUSE/INV + DIN 72552 Code G1/F1/U1',
    },
  },
};

export default meta;
type Story = StoryObj<typeof NodeBlueprint>;

export const Battery: Story = {
  render: () => <BatteryNodeExample />,
  parameters: {
    docs: { description: { story: 'Standard 224px, 4px Radius, 1px Border, mono tabular-nums, 44px Hit' } },
  },
};

export const InverterWarning: Story = {
  render: () => <InverterNodeExample />,
};

export const AllStates: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-4">
      {NODE_STATES.map((state) => (
        <div key={state} className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-widest">{state}</span>
          <div className={NODE_STATE_CLASSES[state]}>
            <div className="p-3 font-mono text-[12px]">{state}</div>
          </div>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          '9-State Matrix: Default, Hover, Active, Focus-Visible, Selected, Dragging, Disabled, Error, Warning — jeder State muss definiert sein (Modul 5)',
      },
    },
  },
};

export const PortHitTargets: Story = {
  render: () => (
    <div className="relative h-[200px] w-[300px] border border-dashed border-[var(--de-rule)]">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <BatteryNodeExample />
      </div>
      <div className="absolute bottom-2 left-2 font-mono text-[10px] text-[var(--de-text-dim)]">
        Visual 12px, Hit 44px — WCAG 2.5.5, Shape-Coding ●■◆▲
      </div>
    </div>
  ),
};

export const DINCompliance: Story = {
  render: () => (
    <div className="flex gap-4">
      {['battery', 'fuse', 'ground', 'inverter', 'solar'].map((k) => (
        <div
          key={k}
          className="flex flex-col items-center gap-2 rounded-[2px] border border-[var(--de-rule)] bg-[var(--de-surface-1)] p-3"
        >
          <span className="font-mono text-[10px] uppercase">{k}</span>
          <div className="h-8 w-8 rounded-[2px] border bg-[var(--de-surface-2)]" />
          <span className="font-mono text-[8px] opacity-60">DIN 72552</span>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Echte DIN 72552 / ISO 14617 SVG — non-scaling-stroke, 1.5px, 4px Radius Max',
      },
    },
  },
};
