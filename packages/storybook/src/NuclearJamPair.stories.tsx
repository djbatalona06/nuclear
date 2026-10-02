import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { NuclearJam } from '@nuclearplayer/ui';

const meta = {
  title: 'Remote/NuclearJam/Pair',
  component: NuclearJam.Pair,
  tags: ['autodocs'],
} satisfies Meta<typeof NuclearJam.Pair>;

export default meta;
type Story = StoryObj<typeof NuclearJam.Pair>;

const labels = {
  title: 'Pair this device',
  subtitle:
    'In Nuclear, open Settings, then Integrations, and choose Pair a new device',
  code: 'Pairing code',
  deviceName: 'Device name',
  submit: 'Pair',
};

const PairStory = ({ error }: { error?: string }) => {
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('Phone');
  return (
    <NuclearJam>
      <NuclearJam.Pair
        code={code}
        deviceName={deviceName}
        onCodeChange={setCode}
        onDeviceNameChange={setDeviceName}
        onSubmit={() => {}}
        error={error}
        labels={labels}
      />
    </NuclearJam>
  );
};

export const Default: Story = {
  render: () => <PairStory />,
};

export const WithError: Story = {
  render: () => (
    <PairStory error="That code is wrong or has expired. Create a new one in Nuclear." />
  ),
};
