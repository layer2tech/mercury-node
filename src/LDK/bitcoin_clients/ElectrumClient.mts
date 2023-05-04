import axios from "axios";
import { BitcoinDaemonClientInterface } from "./BitcoinD.mjs";

const TIMEOUT = 20000;

// CHANGE THESE TO MATCH POLAR
const HOST = "http://136.244.108.27";
const PORT = "3002";
const USER = "polaruser";
const PASS = "polarpass";

class ElectrumClient implements BitcoinDaemonClientInterface {
  endpoint;
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }
  getTxOut(txid: string, vout: number): any {
    throw new Error("Method not implemented.");
  }
  getRawTransaction(txid: string): any {
    throw new Error("Method not implemented.");
  }
  getOutputStatus(txid: Uint8Array, height: number): any {
    throw new Error("Method not implemented.");
  }

  getHeaderByHash(hash: String) {
    throw new Error("Method not implemented.");
  }
  getBlockStatus(hash: String) {
    throw new Error("Method not implemented.");
  }

  async getBestBlockHash() {
    console.log("[ElectrumClient.mts]: getBestBlockHash...");
    let res;
    try {
      res = (await ElectrumClient.get("rest/chaininfo.json")).data;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error Getting Block Height");
    }
    if (res) {
      return res.bestblockhash;
    }
  }

  async getBlockHeight() {
    console.log("[ElectrumClient.mts]: getBlockHeight...");
    let res;
    try {
      res = (await ElectrumClient.get("rest/chaininfo.json")).data;
      return res.blocks;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error Getting Block Height");
    }
  }

  async getBlockHeader(height: number | string) {
    let currentBlockHash;
    try {
      console.log(
        "[ElectrumClient.mts]: getLatestBlockHeader, block_height:",
        height
      );
      currentBlockHash = (
        await ElectrumClient.get(`rest/blockhashbyheight/${height}.json`)
      ).data.blockhash;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error Getting Current Block Hash");
    }

    // return currentBlockHash
    console.log("[ElectrumClient.mts]: Get Latest Block Header...");
    let res;
    try {
      res = (await ElectrumClient.get(`rest/headers/1/${currentBlockHash}.hex`))
        .data;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error in getting header: ", e);
    }

    if (res) {
      return res;
    }
  }

  async getTxIdData(txid: string) {
    let res = (await ElectrumClient.get(`rest/tx/${txid}.json`)).data;

    return {
      txid: res.txid,
      vout: res.vin[0].vout,
      sequence: res.vin[0].sequence,
      height: res.height,
      confirmations: res.confirmations,
    };
  }

  async getUtxoSpentData(txid: string, vout: number) {
    throw new Error("Not yet implemented");
  }

  static async get(endpoint: string, timeout_ms = TIMEOUT) {
    const url = HOST + ":" + PORT + "/" + endpoint;
    const config = {
      method: "get",
      url: url,
      headers: { Accept: "application/json" },
      timeout: timeout_ms,
    };

    return await axios(config);
  }

  static async post(endpoint: string, timeout_ms = TIMEOUT) {
    const options = {
      headers: {
        "Content-Type": "text/plain",
      },
      data: {
        jsonrpc: "1.0",
        id: "curltest",
        method: "getblockchaininfo",
      },
    };

    axios
      .post(
        "http://" + USER + ":" + PASS + "@" + HOST + ":" + PORT + "/",
        options
      )
      .then((response) => {
        console.log("[ElectrumClient.mts]: RESPONSE: ", response.data);
        return response.data;
      })
      .catch((error) => {
        console.log("[ElectrumClient.mts]: ERROR: ", error);
      });
  }
}

export const GET_ROUTE = {
  PING: "/electrs/ping",
  //latestBlockHeader "/Electrs/block/:hash/header",
  BLOCK: "/electrs/block",
  BLOCKS_TIP_HASH: "/electrs/blocks/tip/hash",
  HEADER: "header",
  BLOCKS_TIP_HEIGHT: "/electrs/blocks/tip/height",
  //getTransaction /tx/:txid
  TX: "/electrs/tx",
  //getScriptHashListUnspent /scripthash/:hash/utxo
  SCRIPTHASH: "/electrs/scripthash",
  UTXO: "utxo",
  //getFeeEstimates
  FEE_ESTIMATES: "/electrs/fee-estimates",
  UTXO_SPENT: "/electrs/tx/:txid/outspend/:vout",
};
Object.freeze(GET_ROUTE);

export const POST_ROUTE = {
  //broadcast transaction
  TX: "/electrs/tx",
};
Object.freeze(POST_ROUTE);

export default ElectrumClient;
