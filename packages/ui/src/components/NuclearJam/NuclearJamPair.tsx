import { KeyRound } from 'lucide-react';
import { FC, FormEvent } from 'react';

import { cn } from '../../utils';
import { Button } from '../Button';
import { Input } from '../Input';

export type NuclearJamPairLabels = {
  title: string;
  subtitle: string;
  code: string;
  deviceName: string;
  submit: string;
};

export type NuclearJamPairProps = {
  code: string;
  deviceName: string;
  onCodeChange: (code: string) => void;
  onDeviceNameChange: (deviceName: string) => void;
  onSubmit: () => void;
  isSubmitting?: boolean;
  error?: string;
  labels: NuclearJamPairLabels;
  className?: string;
};

export const NuclearJamPair: FC<NuclearJamPairProps> = ({
  code,
  deviceName,
  onCodeChange,
  onDeviceNameChange,
  onSubmit,
  isSubmitting = false,
  error,
  labels,
  className,
}) => {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-5 p-6',
        className,
      )}
      data-testid="jam-pair-form"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <KeyRound size={48} />
        <h1 className="text-foreground text-3xl">{labels.title}</h1>
        <p className="text-foreground-secondary">{labels.subtitle}</p>
      </div>
      <Input
        label={labels.code}
        value={code}
        onChange={(event) => onCodeChange(event.target.value)}
        autoCapitalize="characters"
        autoComplete="one-time-code"
        autoCorrect="off"
        spellCheck={false}
        size="lg"
        className="font-mono tracking-widest uppercase"
        data-testid="jam-pair-code"
      />
      <Input
        label={labels.deviceName}
        value={deviceName}
        onChange={(event) => onDeviceNameChange(event.target.value)}
        autoComplete="off"
        data-testid="jam-pair-device-name"
      />
      {error && (
        <p
          role="alert"
          className="text-accent-red text-sm font-semibold"
          data-testid="jam-pair-error"
        >
          {error}
        </p>
      )}
      <Button
        type="submit"
        size="lg"
        className="justify-center"
        disabled={isSubmitting || code.trim().length === 0}
        data-testid="jam-pair-submit"
      >
        {labels.submit}
      </Button>
    </form>
  );
};
