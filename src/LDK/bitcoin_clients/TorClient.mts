import axios from "axios";
import { RawAxiosRequestConfig } from "axios";
import { BitcoinDaemonClientInterface } from "./BitcoinD.mjs";

const TIMEOUT = 20000;
const TOR_ENDPOINT = "http://localhost:3001";

class TorClient implements BitcoinDaemonClientInterface {
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
  getHeaderByHash(hash: string): any {
    throw new Error("Method not implemented.");
  }
  getBlockStatus(hash: string): any {
    throw new Error("Method not implemented.");
  }

  async getBestBlockHash() {
    console.log("[TorClient.mts]: getBestBlockHash...");
    let res;
    try {
      res = await TorClient.get(`${TOR_ENDPOINT}${GET_ROUTE.BLOCKS_TIP_HASH}`);

      res = res && res.data;
    } catch (e) {
      console.log("[TorClient.mts]: Error Getting Block Height");
    }
    if (res) {
      return res;
    }
  }

  async getBlockHeight() {
    console.log("[TorClient.mts]: getBlockHeight...");
    let res;
    try {
      res = await TorClient.get(
        `${TOR_ENDPOINT}${GET_ROUTE.BLOCKS_TIP_HEIGHT}`
      );

      res = res && res.data;
    } catch (e) {
      console.log("[TorClient.mts]: Error Getting Block Height");
    }
    if (res) {
      return res;
    }
  }

  async getBlockHeader(height: number | string) {
    let currentBlockHash;
    try {
      console.log("[TorClient.mts]: Get latest block header...............");
      console.log("[TorClient.mts]: block_height: ", height);
      console.log(
        `[TorClient.mts]: ${TOR_ENDPOINT}${GET_ROUTE.BLOCKS_TIP_HASH}`
      );
      let res = await TorClient.get(
        `${TOR_ENDPOINT}${GET_ROUTE.BLOCKS_TIP_HASH}`
      );

      currentBlockHash = res && res.data;
    } catch (e) {
      console.log("[TorClient.mts]: Error Getting Current Block Hash");
    }

    console.log("[TorClient.mts]: Get Latest Block Header...");
    let res;
    try {
      res = await TorClient.get(
        `${TOR_ENDPOINT}/electrs/block/${currentBlockHash}/header`
      );

      res = res && res.data;
    } catch (e) {
      console.log("[TorClient.mts]: Error in getting header: ", e);
    }

    if (res) {
      return res;
    }
  }

  async getTxIdData(txid: string) {
    let res = (await TorClient.get(`${TOR_ENDPOINT}${GET_ROUTE.TX}/${txid}`))
      .data;

    return {
      txid: res.txid,
      vout: res.vin[0].vout,
      sequence: res.vin[0].sequence,
      height: res.height,
    };
  }

  async getUtxoSpentData(txid: string, vout: number) {
    try {
      const res = (
        await TorClient.get(
          `${TOR_ENDPOINT}${GET_ROUTE.UTXO_SPENT}`
            .replace(":txid", txid)
            .replace(":vout", String(vout))
        )
      ).data;
      if (res && res.status === "success" && res.data) {
        return res.data;
      }
      throw new Error("Error fetching UTXO spent data");
    } catch (e: any) {
      throw new Error(e);
    }
  }

  static async get(endpoint: string, timeout_ms = TIMEOUT) {
    const url = endpoint;
    const config: RawAxiosRequestConfig = {
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
      .post(endpoint, options)
      .then((response) => {
        console.log("[TorClient.mts]: RESPONSE: ", response.data);
        return response.data;
      })
      .catch((error) => {
        console.log("[TorClient.mts]: ERROR: ", error);
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

export default TorClient;
