import { QueryClient } from '@tanstack/react-query';
import {
  act,
  render,
  RenderResult,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Queue, Track } from '@nuclearplayer/model';

import {
  REMOTE_DEVICE,
  REMOTE_EMPTY_QUEUE,
  REMOTE_PLAYBACK,
  REMOTE_QUEUE,
  REMOTE_SETTINGS,
} from '../test/fixtures/remoteControl';
import { MockEventSource } from '../test/mocks/eventSource';
import { FetchMock } from '../test/mocks/fetch';
import RemoteApp from './RemoteApp';
import type { PlaybackState, SettingsState } from './remoteStore';
import { useRemoteStore } from './remoteStore';

const user = userEvent.setup();
const MAX_RETRIES = 3;
const UNAUTHORIZED = 401;

export const RemoteControlWrapper = {
  reset() {
    MockEventSource.lastInstance = null;
    useRemoteStore.setState(useRemoteStore.getInitialState());
    vi.stubGlobal('EventSource', MockEventSource);
    vi.restoreAllMocks();
    vi.stubGlobal('EventSource', MockEventSource);
    window.history.replaceState(null, '', '/');
  },

  async mount(): Promise<RenderResult> {
    FetchMock.init();
    FetchMock.get('/api/me', REMOTE_DEVICE);
    const result = render(<RemoteApp queryClientProp={new QueryClient()} />);
    await screen.findByTestId('jam-connecting');
    await waitFor(() => expect(MockEventSource.lastInstance).not.toBeNull());
    return result;
  },

  async mountUnpaired(): Promise<RenderResult> {
    FetchMock.init();
    FetchMock.getError('/api/me', UNAUTHORIZED);
    const result = render(<RemoteApp queryClientProp={new QueryClient()} />);
    await screen.findByTestId('jam-pair-form');
    return result;
  },

  openPairingLink(code: string) {
    window.history.replaceState(null, '', `/#pair=${code}`);
  },

  revokeThisDevice() {
    FetchMock.reset();
    FetchMock.getError('/api/me', UNAUTHORIZED);
  },

  async simulateConnection(options: { emptyQueue?: boolean } = {}) {
    const queue = options.emptyQueue ? REMOTE_EMPTY_QUEUE : REMOTE_QUEUE;
    FetchMock.init();
    FetchMock.get('/api/me', REMOTE_DEVICE);
    FetchMock.get('/api/queue', queue);
    FetchMock.get('/api/playback', REMOTE_PLAYBACK);
    FetchMock.get('/api/settings', REMOTE_SETTINGS);
    FetchMock.get('/api/playback/toggle', {});
    FetchMock.get('/api/playback/next', {});
    FetchMock.get('/api/playback/previous', {});
    FetchMock.get('/api/playback/seek', {});
    FetchMock.get('/api/playback/shuffle', {});
    FetchMock.get('/api/playback/repeat', {});

    await act(async () => {
      MockEventSource.lastInstance?.simulateOpen();
    });

    await screen.findByTestId('connection-status-badge');
  },

  simulateConnectionFailure() {
    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      act(() => {
        MockEventSource.lastInstance?.simulateError();
      });
    }
  },
  simulateConnectionDrop() {
    act(() => {
      MockEventSource.lastInstance?.simulateError();
    });
  },

  get connectingState() {
    return screen.queryByTestId('jam-connecting');
  },

  get errorState() {
    return screen.queryByTestId('jam-error');
  },

  pairing: {
    get form() {
      return screen.queryByTestId('jam-pair-form');
    },
    get error() {
      return screen.queryByTestId('jam-pair-error');
    },
    mockSuccess() {
      FetchMock.get('/api/pair', REMOTE_DEVICE);
    },
    mockFailure(status: number) {
      FetchMock.getError('/api/pair', status);
    },
    codeInput: {
      get element() {
        return screen.getByTestId('jam-pair-code');
      },
      async type(text: string) {
        await user.type(this.element, text);
      },
    },
    deviceNameInput: {
      get element() {
        return screen.getByTestId('jam-pair-device-name');
      },
      async replace(text: string) {
        await user.clear(this.element);
        await user.type(this.element, text);
      },
    },
    submitButton: {
      get element() {
        return screen.getByTestId('jam-pair-submit');
      },
      async click() {
        await user.click(this.element);
      },
    },
    async pairWith(code: string) {
      await this.codeInput.type(code);
      await this.submitButton.click();
    },
  },

  header: {
    get badge() {
      return screen.getByTestId('connection-status-badge');
    },
    get statusText() {
      return screen.getByTestId('connection-status-badge').textContent?.trim();
    },
  },

  nowPlaying: {
    get title() {
      return screen.getByTestId('now-playing-title').textContent;
    },
    get artist() {
      return screen.getByTestId('now-playing-artist').textContent;
    },
  },

  controls: {
    playPauseButton: {
      get element() {
        return (screen.queryByTestId('jam-pause-button') ??
          screen.queryByTestId('jam-play-button'))!;
      },
      async click() {
        await user.click(this.element);
      },
    },
    nextButton: {
      get element() {
        return screen.getByTestId('jam-next-button');
      },
      async click() {
        await user.click(this.element);
      },
    },
    previousButton: {
      get element() {
        return screen.getByTestId('jam-previous-button');
      },
      async click() {
        await user.click(this.element);
      },
    },
    shuffleButton: {
      get element() {
        return screen.getByTestId('jam-shuffle-button');
      },
      async click() {
        await user.click(this.element);
      },
    },
    repeatButton: {
      get element() {
        return screen.getByTestId('jam-repeat-button');
      },
      async click() {
        await user.click(this.element);
      },
    },
  },

  queue: {
    get header() {
      return screen.queryByTestId('jam-queue-header');
    },
    get count() {
      return screen.queryByTestId('jam-queue-count')?.textContent;
    },
    get items() {
      return screen.queryAllByTestId('jam-queue-item');
    },
    get emptyState() {
      return screen.queryByTestId('jam-queue-empty');
    },
    async removeTrack(title: string) {
      const item = screen
        .getAllByTestId('jam-queue-item')
        .find((element) => element.textContent?.includes(title))!;
      await user.click(
        within(item).getByTestId('jam-queue-item-remove-button'),
      );
    },
  },

  search: {
    mockResults(tracks: Track[]) {
      FetchMock.get('/api/search', { tracks });
    },
    mockError() {
      FetchMock.getError('/api/search', 500);
    },
    get drawer() {
      return screen.queryByTestId('jam-search-drawer');
    },
    get emptyState() {
      return screen.queryByTestId('jam-search-empty');
    },
    get errorState() {
      return screen.queryByTestId('jam-search-error');
    },
    get results() {
      return screen.queryAllByTestId('jam-search-result-track');
    },
    input: {
      get element() {
        return screen.getByTestId('jam-search-input');
      },
      async type(text: string) {
        await user.type(this.element, text);
      },
    },
    clearButton: {
      get element() {
        return screen.getByTestId('jam-search-clear');
      },
      async click() {
        await user.click(this.element);
      },
    },
    async addTrack(title: string) {
      await user.click(await screen.findByText(title));
    },
  },

  sendQueueUpdate(queue: Queue) {
    act(() => {
      MockEventSource.lastInstance?.simulateEvent('queue', queue);
    });
  },

  sendPlaybackUpdate(playback: PlaybackState) {
    act(() => {
      MockEventSource.lastInstance?.simulateEvent('playback', playback);
    });
  },

  sendSettingsUpdate(settings: SettingsState) {
    act(() => {
      MockEventSource.lastInstance?.simulateEvent('settings', settings);
    });
  },
};
