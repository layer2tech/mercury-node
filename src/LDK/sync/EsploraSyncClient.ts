import {
  Confirm,
  FilterInterface,
  OutPoint,
  TwoTuple_usizeTransactionZ,
  WatchedOutput,
} from "lightningdevkit";
import ElectrumClient from "../bitcoin_clients/ElectrumClient.mjs";
import TorClient from "../bitcoin_clients/TorClient.mjs";
import { FilterQueue, SyncState, newSyncState } from "./FilterQueue.js";
import { Mutex } from "async-mutex";
import { hexToUint8Array, uint8ArrayToHexString } from "../utils/utils.js";
import { Transaction } from "bitcoinjs-lib";
import { BitcoinDaemonClientInterface } from "../bitcoin_clients/BitcoinD.mjs";
import { InternalError, TxSyncError } from "./Error.js";

// Custom Logging
import { ChalkColor, Logger } from "../utils/Logger.js";
import chalk from "chalk";
const DEBUG = new Logger(ChalkColor.Magenta, "EsploraSyncClient.ts");

interface ConfirmedTx {
  txs: [[0, Transaction]];
  //tx: Transaction;
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
    let tx_string = uint8ArrayToHexString(txid);
    let reversed_txid = this.reverse_txid(tx_string) ?? tx_string;

    this.lock.acquire().then((release) => {
      this.filter_queue.transactions.add(reversed_txid); // saved as hex string rather than uint8array
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
    DEBUG.log("Starting transaction sync.", "sync");
    let tip_hash = await this.bitcoind_client.getBestBlockHash();
    let sync_state = this.sync_state; // Check this, no lock?

    while (true) {
      let pending_registrations = this.filter_queue.processQueues(sync_state);
      let tip_is_new = tip_hash !== sync_state.last_sync_hash;

      if (!sync_state.pending_sync && !pending_registrations && !tip_is_new) {
        DEBUG.log("Nothing to do. Exiting sync loop.", "sync");
        break;
      } else {
        if (tip_is_new) {
          DEBUG.log("if tip_is_new", "sync");
          try {
            let unconfirmed_txs = await this.get_unconfirmed_transactions(
              confirmables
            );
            let check_tip_hash = await this.bitcoind_client.getBestBlockHash();

            if (check_tip_hash !== tip_hash) {
              DEBUG.log("if check_tip_hash !== tip_hash -> continue", "sync");
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
            DEBUG.log("Failed during transaction sync, aborting.", "sync", err);
            sync_state.pending_sync = true;
            return new Error("" + err); // Check me
          }

          try {
            await this.sync_best_block_updated(confirmables, tip_hash);
          } catch (err) {
            if (
              err instanceof InternalError && // Check me
              err === InternalError.Inconsistency // Check me
            ) {
              // Immediately restart syncing when we encounter any inconsistencies.
              DEBUG.log(
                "Encountered inconsistency during transaction sync, restarting.",
                "sync"
              );
              sync_state.pending_sync = true;
              continue;
            } else {
              // (Semi-)permanent failure, retry later.
              sync_state.pending_sync = true;
              return Error(TxSyncError.from(err)); // Check me
            }
          }
        }

        DEBUG.log("Continue", "sync");
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
          /*
          if (
            err instanceof InternalError &&
            err === InternalError.Inconsistency
          ) {
            // Immediately restart syncing when we encounter any inconsistencies.
            DEBUG.log(
              "Encountered inconsistency during transaction sync, restarting.",
              "sync"
            );
            sync_state.pending_sync = true;
            continue;
          } else {
            // (Semi-)permanent failure, retry later.
            DEBUG.log("Failed during transaction sync, aborting.", "sync");
            sync_state.pending_sync = true;
            return Error(TxSyncError.from(err));
          }*/
          DEBUG.log("Failed during transaction sync, aborting.", "sync", err);
        }

        sync_state.last_sync_hash = tip_hash;
        sync_state.pending_sync = false;
      }
    }

    DEBUG.log("***** sync complete *****", "sync");
    return true;
  }

  async sync_best_block_updated(
    confirmables: Confirm[], // chainMonitor.asConfirm(), channelManager.asConfirm()
    tipHash: string //BlockHash
  ): Promise<void> {
    DEBUG.log("confirmables, tipHash", "sync_best_block_updated");
    console.table({ confirmables, tipHash });

    // Inform the interface of the new block.
    const tipHeader = await this.bitcoind_client.getHeaderByHash(tipHash);
    const tipStatus = await this.bitcoind_client.getBlockStatus(tipHash);

    DEBUG.log("tipHeader->", "sync_best_block_updated", tipHeader);
    DEBUG.log("tipStatus->", "sync_best_block_updated", tipStatus);
    console.table(tipStatus);

    if (tipStatus.in_best_chain) {
      DEBUG.log("tipStatus.in_best_chain -> true", "sync_best_block_updated");
      if (tipStatus.height !== undefined) {
        DEBUG.log(
          "tipStatus.in_best_chain -> tipStatus.height !== undefined",
          "sync_best_block_updated"
        );
        confirmables.forEach((c) => {
          DEBUG.log(
            "c.best_block_updated(confirmables)",
            "sync_best_block_updated"
          );
          c.best_block_updated(hexToUint8Array(tipHeader), tipStatus.height);
        });
      }
    } else {
      DEBUG.err("InternalError.Inconsistency");
    }
    return;
  }

  async sync_confirmed_transactions(
    sync_state: SyncState,
    confirmables: Confirm[],
    confirmed_txs: ConfirmedTx[]
  ): Promise<void> {
    DEBUG.log("*********", "sync_confirmed_transactions");
    for (const ctx of confirmed_txs) {
      let transaction = ctx.txs[0][1];
      for (const c of confirmables) {
        const txdata = [
          TwoTuple_usizeTransactionZ.constructor_new(
            ctx.block_height,
            transaction.toBuffer()
          ),
        ];

        let hex_block_header = await this.bitcoind_client.getHeaderByHash(
          ctx.block_header.id
        );

        c.transactions_confirmed(
          hexToUint8Array(hex_block_header),
          txdata,
          ctx.block_height
        );
      }
      sync_state.watched_transactions.delete(transaction.toHex());

      /*
      [
        {
          hash: <Buffer c3 1c 87 eb 2a 22 f5 00 88 7a e6 3b 87 c9 6f 8c 2c 3f 55 ad f9 5d 09 41 e2 64 78 fd df 9d a9 cd>,
          index: 1,
          script: <Buffer >,
          sequence: 4294967295,
          witness: [
            <Buffer 30 45 02 21 00 c4 20 92 95 49 d8 bf d0 ac e9 01 c1 0d 85 e6 20 57 e6 d3 11 73 a5 50 02 e2 9b 0e d9 60 a2 3e 39 02 20 52 5a 37 b3 b4 16 2c 9d 68 9d 4f ... 22 more bytes>,
            <Buffer 02 56 8b a8 7b e9 04 07 0f e0 50 20 25 79 9f 0a 34 a8 1c c5 d7 bd 5c 21 d5 c3 e3 e1 cd 60 8d 5e 27>
          ]
        }
      ]*/

      for (const input of ctx.txs[0][1].ins) {
        sync_state.watched_outputs.delete(
          OutPoint.constructor_new(input.hash, input.index)
        );
      }
    }
  }

  async get_confirmed_transactions(
    sync_state: SyncState
  ): Promise<ConfirmedTx[]> {
    let confirmed_txs: ConfirmedTx[] = [];

    for (const txid of sync_state.watched_transactions) {
      DEBUG.log("******", "get_confirmed_transactions");
      DEBUG.log(
        "txid get confirmed,txid:@",
        "get_confirmed_transactions",
        txid
      );

      // reverse byte txid here
      let txid_data = await this.bitcoind_client.getTxIdData(txid);

      DEBUG.log(
        "block_hash found->",
        "get_confirmed_transactions",
        txid_data?.hash
      );
      DEBUG.log(
        "block_height found->",
        "get_confirmed_transactions",
        txid_data?.height
      );

      const confirmed_tx = await this.get_confirmed_tx(
        txid,
        txid_data?.hash,
        txid_data?.height
      );
      if (confirmed_tx) {
        confirmed_txs.push(confirmed_tx);
      }
    }

    for (const [, output] of sync_state.watched_outputs) {
      let hex_tx = uint8ArrayToHexString(output.get_outpoint().get_txid());

      // check me
      const output_status = await this.bitcoind_client.getTxOut(
        hex_tx,
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

  reverse_txid(txid: string) {
    let reverse_txid = txid
      .match(/[a-fA-F0-9]{2}/g)
      ?.reverse()
      .join("");
    return reverse_txid;
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
    DEBUG.log("Get relevantTxids", "get_unconfirmed_transactions");

    const relevantTxids = new Set(
      confirmables
        .map((c) => c.get_relevant_txids())
        .flat()
        .map((tuple) => [
          uint8ArrayToHexString(tuple.get_a()),
          uint8ArrayToHexString(tuple.get_b()),
        ])
    );

    DEBUG.log("relevantTxids->", "get_unconfirmed_transactions", relevantTxids);

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

    DEBUG.log(
      "returning unconfirmedTxs ->",
      "get_unconfirmed_transactions",
      unconfirmedTxs
    );
    return unconfirmedTxs;
  }

  sync_unconfirmed_transactions(
    sync_state: SyncState,
    confirmables: Confirm[],
    unconfirmed_txs: string[]
  ): void {
    DEBUG.log(
      "unconfirmed_txs passed in:",
      "sync_unconfirmed_transactions",
      unconfirmed_txs
    );
    for (const txid of unconfirmed_txs) {
      for (const c of confirmables) {
        c.transaction_unconfirmed(hexToUint8Array(txid)); //convert back to uint8array
      }
      sync_state.watched_transactions.add(txid);
    }
  }
}
