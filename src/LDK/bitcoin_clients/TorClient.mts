import { RawAxiosRequestConfig } from "axios";

const TIMEOUT = 20000;
const TOR_ENDPOINT = "http://localhost:3001";

class TorClient {
  endpoint;
  constructor(endpoint: string) {
    this.endpoint = endpoint;
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

  async getLatestBlockHeader(height: number) {
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

    // return currentBlockHash
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
      // console.log('BLOCK JEADER::: ',res)
      // console.log(res);
      // const blockArray = new Uint8Array(Buffer.from(JSON.stringify(res.tx)))
      return res;
    }
  }

  async getTxIdData(txid: string) {
    try {
      const res = (await TorClient.get(`${TOR_ENDPOINT}/tx/${txid}`)).data;
      if (res) {
        const { vin, blockheight, hex } = res.data;
        const { sequence, vout } = vin[0];
        return { sequence, vout, blockheight, hex };
      }
      throw new Error("No res.data found");
    } catch (e: any) {
      throw new Error(e);
    }
  }

  static async get(endpoint: string, timeout_ms = TIMEOUT) {
    const axios = (await import("axios")).default;

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
    const axios = (await import("axios")).default;
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
};
Object.freeze(GET_ROUTE);

export const POST_ROUTE = {
  //broadcast transaction
  TX: "/electrs/tx",
};
Object.freeze(POST_ROUTE);

export default TorClient;
