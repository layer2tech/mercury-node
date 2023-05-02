import { OutPoint, WatchedOutput } from "lightningdevkit";

export default class SyncClient {
  watchedTransactions: Set<Uint8Array>;
  watchedOutputs: Map<OutPoint, WatchedOutput>;

  constructor() {
    this.watchedTransactions = new Set();
    this.watchedOutputs = new Map();
  }
}
