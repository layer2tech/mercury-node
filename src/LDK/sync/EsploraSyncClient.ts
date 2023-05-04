import { Confirm, FilterInterface, WatchedOutput } from "lightningdevkit";
import ElectrumClient from "../bitcoin_clients/ElectrumClient.mjs";
import TorClient from "../bitcoin_clients/TorClient.mjs";
import { FilterQueue } from "./FilterQueue.js";
// import { BlockHash } from "./FilterQueue.js";
import { Mutex } from "async-mutex";
import { uint8ArrayToHexString } from "../utils/utils.js";

export default class EsploraSyncClient implements FilterInterface {
  bitcoind_client: ElectrumClient | TorClient;
  lock: Mutex;
  filter_queue: FilterQueue;

  constructor(_bitcoind_client: any) {
    this.bitcoind_client = _bitcoind_client;
    this.filter_queue = new FilterQueue();
    this.lock = new Mutex();
  }

  register_tx(txid: Uint8Array, script_pubkey: Uint8Array) {
    this.lock.acquire().then((release) => {
      this.filter_queue.transactions.add(uint8ArrayToHexString(txid)); // saved as hex string rather than uint8array
      release();
    });
  }

  register_output(output: WatchedOutput) {
    this.lock.acquire().then((release) => {
      this.filter_queue.outputs.set(output.get_outpoint(), output);
      release();
    });
  }

  async syncBestBlockUpdated(
    confirmables: Confirm[], // chainMonitor.asConfirm(), channelManager.asConfirm()
    tipHash: string //BlockHash
  ): Promise<void> {
    // Inform the interface of the new block.
    const tipHeader = await this.bitcoind_client.getHeaderByHash(tipHash);
    const tipStatus = await this.bitcoind_client.getBlockStatus(tipHash);

    if (tipStatus.in_best_chain) {
      if (tipStatus.height != null) {
        for (const c of confirmables) {
          c.best_block_updated(tipHeader, tipStatus.height);
        }
      }
    } else {
      throw new Error("InternalError.Inconsistency");
    }
    return;
  }
}
