import { FilterInterface, WatchedOutput } from "lightningdevkit";
import SyncClient from "../sync/EsploraSyncClient";

class MercuryFilter implements FilterInterface {
  syncClient: SyncClient;
  constructor(_syncClient: SyncClient) {
    this.syncClient = _syncClient;
  }

  register_tx(txid: Uint8Array, script_pubkey: Uint8Array): void {
    // <insert code for you to watch for this transaction on-chain>
    console.log("[MercuryFilter.ts/register_tx]: TXID found:", txid);
    console.log(
      "[MercuryFilter.ts/register_tx]: script_pubkey found:",
      script_pubkey
    );

    //this.syncClient.watchedTransactions.add(txid);
  }

  register_output(output: WatchedOutput): void {
    // <insert code for you to watch for any transactions that spend this
    //  output on-chain>
    console.log("[MercuryFilter.ts/register_output]: output found:", output);

    //this.syncClient.watchedOutputs.set(output.get_outpoint(), output);
  }
}

export default MercuryFilter;
