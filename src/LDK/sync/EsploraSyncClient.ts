import {
  Confirm,
  FilterInterface,
  TwoTuple_TxidBlockHashZ,
  TwoTuple_usizeTransactionZ,
  WatchedOutput,
} from "lightningdevkit";
import ElectrumClient from "../bitcoin_clients/ElectrumClient.mjs";
import TorClient from "../bitcoin_clients/TorClient.mjs";
import { FilterQueue, SyncState, newSyncState } from "./FilterQueue.js";
// import { BlockHash } from "./FilterQueue.js";
import { Mutex } from "async-mutex";
import { hexToUint8Array, uint8ArrayToHexString } from "../utils/utils.js";
import { Transaction } from "bitcoinjs-lib";
import { BitcoinDaemonClientInterface } from "../bitcoin_clients/BitcoinD.mjs";

interface ConfirmedTx {
  tx: Transaction; // What library is this 'Transaction' from for typescript?
  txid: string; // added instead of tx
  block_header: any;
  block_height: any;
  pos: number;
}

export default class EsploraSyncClient implements FilterInterface {
  bitcoind_client: ElectrumClient | TorClient;
  lock: Mutex;
  filter_queue: FilterQueue;
  sync_state!: SyncState;

  constructor(_bitcoind_client: any) {
    this.bitcoind_client = _bitcoind_client;
    this.filter_queue = new FilterQueue();
    this.lock = new Mutex();
    this.sync_state = newSyncState();
  }

  static from_client(bitcoind_client: BitcoinDaemonClientInterface) {
    return new EsploraSyncClient(bitcoind_client);
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

  async sync(confirmables: Confirm[]) {
    console.log("Starting transaction sync.");
    let tip_hash = await this.bitcoind_client.getBestBlockHash();
    let sync_state = this.sync_state; // Check this, no lock?

    while (true) {
      let pending_registrations = this.filter_queue.processQueues(sync_state);
      let tip_is_new = tip_hash !== sync_state.last_sync_hash;

      // We loop until any registered transactions have been processed at least once, or the
      // tip hasn't been updated during the last iteration.
      if (!sync_state.pending_sync && !pending_registrations && !tip_is_new) {
        // Nothing to do.
        break;
      } else {
        // Update the known tip to the newest one.
        if (tip_is_new) {
          // First check for any unconfirmed transactions and act on it immediately.
          let unconfirmed_txs = await this.get_unconfirmed_transactions(
            confirmables
          );
          // Check this type doesn't exist
          if (unconfirmed_txs instanceof TxSyncError) {
            // (Semi-)permanent failure, retry later.
            console.error(
              "Failed during transaction sync, aborting.",
              unconfirmed_txs
            );
            sync_state.pending_sync = true;
            throw unconfirmed_txs;
          }

          // Double-check the tip hash. If it changed, a reorg happened since
          // we started syncing and we need to restart last-minute.
          let check_tip_hash = await this.bitcoind_client.getBestBlockHash();
          if (check_tip_hash !== tip_hash) {
            tip_hash = check_tip_hash;
            continue;
          }

          this.sync_unconfirmed_transactions(
            sync_state,
            confirmables,
            unconfirmed_txs
          );
          let sync_best_block_updated_err: any =
            await this.sync_best_block_updated(confirmables, tip_hash);
          if (sync_best_block_updated_err instanceof TxSyncError) {
            sync_state.pending_sync = true;
            throw sync_best_block_updated_err;
          } else if (sync_best_block_updated_err instanceof InternalError) {
            // Immediately restart syncing when we encounter any inconsistencies.
            console.debug(
              "Encountered inconsistency during transaction sync, restarting."
            );
            sync_state.pending_sync = true;
            continue;
          }
        }
      }
    }

    while (true) {
      let pending_registrations = this.filter_queue.processQueues(sync_state);
      let tip_is_new = tip_hash !== sync_state.last_sync_hash;

      if (!sync_state.pending_sync && !pending_registrations && !tip_is_new) {
        // Nothing to do.
        break;
      } else {
        if (tip_is_new) {
          try {
            let unconfirmed_txs = await this.get_unconfirmed_transactions(
              confirmables
            );
            let check_tip_hash = await this.bitcoind_client.getBestBlockHash();

            if (check_tip_hash !== tip_hash) {
              tip_hash = check_tip_hash;
              continue;
            }

            this.sync_unconfirmed_transactions(
              sync_state,
              confirmables,
              unconfirmed_txs
            );
          } catch (err) {
            // (Semi-)permanent failure, retry later.
            console.log("Failed during transaction sync, aborting.");
            sync_state.pending_sync = true;
            return Err(TxSyncError.from(err));
          }

          try {
            await this.sync_best_block_updated(confirmables, tip_hash);
          } catch (err) {
            if (
              err instanceof InternalError &&
              err === InternalError.Inconsistency
            ) {
              // Immediately restart syncing when we encounter any inconsistencies.
              console.log(
                "Encountered inconsistency during transaction sync, restarting."
              );
              sync_state.pending_sync = true;
              continue;
            } else {
              // (Semi-)permanent failure, retry later.
              sync_state.pending_sync = true;
              return Error(TxSyncError.from(err));
            }
          }
        }

        try {
          let confirmed_txs = await this.get_confirmed_transactions(sync_state);
          let check_tip_hash = await this.bitcoind_client.getBestBlockHash();

          if (check_tip_hash !== tip_hash) {
            tip_hash = check_tip_hash;
            continue;
          }

          this.sync_confirmed_transactions(
            sync_state,
            confirmables,
            confirmed_txs
          );
        } catch (err) {
          if (
            err instanceof InternalError &&
            err === InternalError.Inconsistency
          ) {
            // Immediately restart syncing when we encounter any inconsistencies.
            console.log(
              "Encountered inconsistency during transaction sync, restarting."
            );
            sync_state.pending_sync = true;
            continue;
          } else {
            // (Semi-)permanent failure, retry later.
            console.log("Failed during transaction sync, aborting.");
            sync_state.pending_sync = true;
            return Error(TxSyncError.from(err));
          }
        }

        sync_state.last_sync_hash = tip_hash;
        sync_state.pending_sync = false;
      }
    }
  }

  async sync_best_block_updated(
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

  sync_confirmed_transactions(
    sync_state: SyncState,
    confirmables: Confirm[],
    confirmed_txs: ConfirmedTx[]
  ): void {
    for (const ctx of confirmed_txs) {
      for (const c of confirmables) {
        const txdata = [
          TwoTuple_usizeTransactionZ.constructor_new(
            ctx.pos,
            hexToUint8Array(ctx.txid)
          ), // Check this
        ];

        c.transactions_confirmed(
          hexToUint8Array(ctx.block_header),
          txdata,
          ctx.block_height
        );
      }

      sync_state.watched_transactions.delete(ctx.txid);

      // No input value here ?
      for (const input of ctx.tx.input) {
        sync_state.watched_outputs.delete(input.previous_output);
      }
    }
  }

  async get_confirmed_transactions(
    sync_state: SyncState
  ): Promise<ConfirmedTx[]> {
    let confirmed_txs: ConfirmedTx[] = [];

    for (const txid of sync_state.watched_transactions) {
      const confirmed_tx = await this.get_confirmed_tx(
        txid,
        undefined,
        undefined
      );
      if (confirmed_tx) {
        confirmed_txs.push(confirmed_tx);
      }
    }

    for (const [, output] of sync_state.watched_outputs) {
      const output_status = await this.bitcoind_client.getOutputStatus(
        output.get_outpoint().get_txid(),
        output.get_outpoint().get_index()
      );

      if (output_status && output_status.txid && output_status.status) {
        const { txid: spending_txid, status: spending_tx_status } =
          output_status;

        const confirmed_tx = await this.get_confirmed_tx(
          spending_txid,
          spending_tx_status.block_hash,
          spending_tx_status.block_height
        );

        if (confirmed_tx) {
          confirmed_txs.push(confirmed_tx);
        }
      }
    }

    confirmed_txs.sort((tx1, tx2) => {
      return tx1.block_height - tx2.block_height || tx1.pos - tx2.pos;
    });

    return confirmed_txs;
  }

  async get_confirmed_tx(
    txid: string,
    block_hash: string | undefined,
    block_height: number | undefined
  ): Promise<ConfirmedTx | any> {
    if (block_hash !== undefined && block_height !== undefined) {
      const block_header = await this.bitcoind_client.getBlockHeader(
        block_hash
      );
      if (!block_header) {
        return undefined;
      }

      const tx_hex = await this.bitcoind_client.getRawTransaction(txid);
      if (!tx_hex) {
        return undefined;
      }

      const tx = Transaction.fromHex(tx_hex);

      return {
        block_header,
        txs: [[0, tx]],
        block_height,
      };
    }

    const txout = await this.bitcoind_client.getTxOut(txid, 0);
    if (!txout || !txout.confirmations) {
      return undefined;
    }

    const tx_hex = await this.bitcoind_client.getRawTransaction(txid);
    if (!tx_hex) {
      return undefined;
    }

    const tx = Transaction.fromHex(tx_hex);

    return {
      block_header: undefined,
      txs: [[0, tx]],
      block_height: txout.confirmations,
    };
  }

  async get_unconfirmed_transactions(confirmables: Confirm[]) {
    // Query the interface for relevant txids and check whether the relevant blocks are still
    // in the best chain, mark them unconfirmed otherwise

    const relevantTxids = new Set(
      confirmables
        .map((c) => c.get_relevant_txids())
        .flat()
        .map((tuple) => [
          uint8ArrayToHexString(tuple.get_a()),
          uint8ArrayToHexString(tuple.get_b()),
        ])
    );

    const unconfirmedTxs: string[] | any = []; //txid[]

    for (const [txid, blockHashOpt] of relevantTxids) {
      if (blockHashOpt !== undefined) {
        const blockStatus = await this.bitcoind_client.getBlockStatus(
          blockHashOpt
        );
        if (blockStatus.in_best_chain) {
          // Skip if the block in question is still confirmed.
          continue;
        }

        unconfirmedTxs.push(txid);
      }
    }
    return unconfirmedTxs;
  }

  sync_unconfirmed_transactions(
    sync_state: SyncState,
    confirmables: Confirm[],
    unconfirmed_txs: string[]
  ): void {
    for (const txid of unconfirmed_txs) {
      for (const c of confirmables) {
        c.transaction_unconfirmed(hexToUint8Array(txid)); //convert back to uint8array
      }
      sync_state.watched_transactions.add(txid);
    }
  }
}
