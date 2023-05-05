import axios from "axios";
import { BitcoinDaemonClientInterface } from "./BitcoinD.mjs";

const TIMEOUT = 20000;

// CHANGE THESE TO THE ESPLORA HOST
const HOST = "http://136.244.108.27";
const PORT = "3002";
const USER = "";
const PASS = "";

class ElectrumClient implements BitcoinDaemonClientInterface {
  /* 
    Example output:
    {"spent":false}
  */
  async getTxOut(txid: string, vout: number): Promise<any> {
    console.log("[ElectrumClient.mts]: getTxOut...");
    let res;
    try {
      res = (await ElectrumClient.get(`tx/${txid}/outspend/${vout}`)).data;
      return res;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error getTxOut", e);
    }
  }

  /*
    Example output:
    020000000001010000000000000000000000000000000000000000000000000000000000000000ffffffff0402360100ffffffff02807c814a000000001600143d27b06f0539ca6a16e4d521ec2ee7b9ab720fcd0000000000000000266a24aa21a9ede2f61c3f71d1defd3fa999dfa36953755c690689799962b48bebd836974e8cf90120000000000000000000000000000000000000000000000000000000000000000000000000
  */
  async getRawTransaction(txid: string): Promise<any> {
    console.log("[ElectrumClient.mts]: getRawTransaction...");
    let res;
    try {
      res = (await ElectrumClient.get(`tx/${txid}/hex`)).data;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error Getting raw transaction", e);
    }
    return res;
  }

  /* 
    Example output:
    00000030e856389b81d90c101f736098a4e023741d5b7e87d6cd0d709a2acbbe5c45f965aa24be79c071ea43c4c59d211ac764507daaa405b397cc475b1308984b1b265b94cf5364ffff7f2000000000
  */
  async getHeaderByHash(hash: String) {
    console.log("[ElectrumClient.mts]: getHeaderByHash...");
    let res;
    try {
      res = (await ElectrumClient.get(`block/${hash}/header`)).data;
      return res;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error getHeaderByHash", e);
    }
  }

  /*
    Example output:
    {"in_best_chain":true,"height":320,"next_best":null}
  */
  async getBlockStatus(hash: String) {
    console.log("[ElectrumClient.mts]: getBlockStatus...");
    let res;
    try {
      res = (await ElectrumClient.get(`block/${hash}/status`)).data;
      return res;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error getBlockStatus", e);
    }
  }

  async getBestBlockHash() {
    console.log("[ElectrumClient.mts]: getBestBlockHash...");
    let res;
    try {
      res = (await ElectrumClient.get("blocks/tip/hash")).data;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error Getting Block Height");
    }
    return res;
  }

  async getBestBlockHeight() {
    console.log("[ElectrumClient.mts]: getBlockHeight...");
    let res;
    try {
      res = (await ElectrumClient.get("blocks/tip/height")).data;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error Getting Block Height");
    }
    return res;
  }

  async getHashByHeight(height: number | string) {
    // First get the hash of the block height
    let block_hash;
    try {
      console.log(
        "[ElectrumClient.mts/getHashByHeight]: height entered:",
        height
      );
      block_hash = (await ElectrumClient.get(`block-height/${height}`)).data;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error Getting Current Block Hash");
    }
    return block_hash;
  }

  /*
    Example output:
    { "id":"6308b34593df109d39b2c9dfd12ee181a57ce0b8d277c09ef423db6f644e37a3",
    "height":320,"version":805306368,"timestamp":1683214228,"tx_count":1,"size":250,"weight":892,
    "merkle_root":"5b261b4b9808135b47cc97b305a4aa7d5064c71a219dc5c443ea71c079be24aa",
    "previousblockhash":"65f9455cbecb2a9a700dcdd6877e5b1d7423e0a49860731f100cd9819b3856e8",
    "mediantime":1683214227,"nonce":0,"bits":545259519,"difficulty":0 }
  */
  async getBlockHeader(height: number | string) {
    let currentBlockHash = await this.getHashByHeight(height);
    console.log("[ElectrumClient.mts]: Get Latest Block Header...");
    let res;
    try {
      res = (await ElectrumClient.get(`block/${currentBlockHash}`)).data;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error in getting header: ", e);
    }
    return res;
  }

  /*
    Example output:
    {"id":"6308b34593df109d39b2c9dfd12ee181a57ce0b8d277c09ef423db6f644e37a3","height":320,"version":805306368,"timestamp":1683214228,"tx_count":1,"size":250,"weight":892,"merkle_root":"5b261b4b9808135b47cc97b305a4aa7d5064c71a219dc5c443ea71c079be24aa","previousblockhash":"65f9455cbecb2a9a700dcdd6877e5b1d7423e0a49860731f100cd9819b3856e8","mediantime":1683214227,"nonce":0,"bits":545259519,"difficulty":0}
  */
  async getTxIdData(txid: string) {
    try {
      const res = (await ElectrumClient.get(`tx/${txid}`)).data;

      return {
        txid: res?.txid ?? "",
        vout: res?.vin[0]?.vout ?? -1,
        sequence: res?.vin[0]?.sequence ?? -1,
        height: res?.status?.block_height ?? -1,
        confirmations: res?.status?.confirmed ?? false,
      };
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error in getTxIdData", e);
      return null;
    }
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
