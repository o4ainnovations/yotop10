declare global {
  interface Window {
    __yotop10_sendSkipWaiting?: () => Promise<void> | void;
    __yotop10_replayQueue?: () => Promise<void> | void;
  }
}

export {};
