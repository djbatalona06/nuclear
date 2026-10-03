import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC, useState } from 'react';

import { NuclearJamPair, NuclearJamPairProps } from './NuclearJamPair';

const labels = {
  title: 'Pair this device',
  subtitle: 'Enter the code shown in Nuclear',
  code: 'Pairing code',
  deviceName: 'Device name',
  submit: 'Pair',
};

const noop = () => {};

const ControlledPair: FC<Partial<NuclearJamPairProps>> = (overrides) => {
  const [code, setCode] = useState('');
  const [deviceName, setDeviceName] = useState('Phone');
  return (
    <NuclearJamPair
      code={code}
      deviceName={deviceName}
      onCodeChange={setCode}
      onDeviceNameChange={setDeviceName}
      onSubmit={noop}
      labels={labels}
      {...overrides}
    />
  );
};

describe('NuclearJamPair', () => {
  it('(Snapshot) renders the empty form', () => {
    const { container } = render(
      <NuclearJamPair
        code=""
        deviceName="Phone"
        onCodeChange={noop}
        onDeviceNameChange={noop}
        onSubmit={noop}
        labels={labels}
      />,
    );
    expect(container).toMatchSnapshot();
  });

  it('(Snapshot) renders with an error', () => {
    const { container } = render(
      <NuclearJamPair
        code="ABCD2345"
        deviceName="Phone"
        onCodeChange={noop}
        onDeviceNameChange={noop}
        onSubmit={noop}
        error="That code is wrong or has expired"
        labels={labels}
      />,
    );
    expect(container).toMatchSnapshot();
  });

  it('disables submit until a code is entered', async () => {
    render(<ControlledPair />);

    expect(screen.getByTestId('jam-pair-submit')).toBeDisabled();

    await userEvent.type(screen.getByTestId('jam-pair-code'), 'ABCD2345');

    expect(screen.getByTestId('jam-pair-submit')).toBeEnabled();
  });

  it('submits with the entered values', async () => {
    const onSubmit = vi.fn();
    render(<ControlledPair onSubmit={onSubmit} />);

    await userEvent.type(screen.getByTestId('jam-pair-code'), 'ABCD2345');
    await userEvent.clear(screen.getByTestId('jam-pair-device-name'));
    await userEvent.type(
      screen.getByTestId('jam-pair-device-name'),
      'Kitchen iPad',
    );
    await userEvent.click(screen.getByTestId('jam-pair-submit'));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(screen.getByTestId('jam-pair-code')).toHaveValue('ABCD2345');
    expect(screen.getByTestId('jam-pair-device-name')).toHaveValue(
      'Kitchen iPad',
    );
  });

  it('disables submit while pairing is in progress', () => {
    render(
      <NuclearJamPair
        code="ABCD2345"
        deviceName="Phone"
        onCodeChange={noop}
        onDeviceNameChange={noop}
        onSubmit={noop}
        isSubmitting
        labels={labels}
      />,
    );

    expect(screen.getByTestId('jam-pair-submit')).toBeDisabled();
  });

  it('shows a hint when one is given', () => {
    render(
      <NuclearJamPair
        code=""
        deviceName="Phone"
        onCodeChange={noop}
        onDeviceNameChange={noop}
        onSubmit={noop}
        hint="Add this page to your home screen first"
        labels={labels}
      />,
    );

    expect(screen.getByTestId('jam-pair-hint')).toHaveTextContent(
      'Add this page to your home screen first',
    );
  });
});
