const IOS_DEVICE_PATTERN = /iPhone|iPad|iPod/;
const DESKTOP_SAFARI_PATTERN = /Macintosh/;
const MIN_TOUCH_POINTS_FOR_IPAD = 2;

type NavigatorWithStandalone = Navigator & { standalone?: boolean };

const isIosDevice = () => {
  const { userAgent, maxTouchPoints } = window.navigator;
  const isIpadWithDesktopUserAgent =
    DESKTOP_SAFARI_PATTERN.test(userAgent) &&
    maxTouchPoints >= MIN_TOUCH_POINTS_FOR_IPAD;
  return IOS_DEVICE_PATTERN.test(userAgent) || isIpadWithDesktopUserAgent;
};

const isRunningFromHomeScreen = () =>
  (window.navigator as NavigatorWithStandalone).standalone === true ||
  window.matchMedia?.('(display-mode: standalone)').matches === true;

export const shouldSuggestHomeScreen = () =>
  isIosDevice() && !isRunningFromHomeScreen();

export const registerServiceWorker = () => {
  if (import.meta.env.DEV || !('serviceWorker' in window.navigator)) {
    return;
  }
  window.navigator.serviceWorker
    .register('/sw.js')
    .catch((error) =>
      console.error('Service worker registration failed:', error),
    );
};
