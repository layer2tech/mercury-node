export interface BitcoinDaemonClientInterface {
  getBestBlockHash(): any;
  getBlockHeight(): any;
  getBlockHeader(height: number): any;
  getBlockHeader(hash: string): any;
  getTxIdData(txid: string): any;
  getUtxoSpentData(txid: string, vout: number): any;
  getHeaderByHash(hash: string): any;
  getBlockStatus(hash: string): any;
  getOutputStatus(txid: Uint8Array, height: number): any;
  getRawTransaction(txid: string): any;
  getTxOut(txid: string, vout: number): any;
}
