export interface BitcoinDaemonClientInterface {
  getBestBlockHash(): any;
  getBlockHeight(): any;
  getBlockHeader(height: number): any;
  getTxIdData(txid: string): any;
  getUtxoSpentData(txid: string, vout: number): any;
  getHeaderByHash(hash: string): any;
  getBlockStatus(hash: string): any;
}
