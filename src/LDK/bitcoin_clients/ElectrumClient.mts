const TIMEOUT = 20000;

// CHANGE THESE TO MATCH POLAR
const POLAR_HOST = "http://127.0.0.1";
const POLAR_PORT = "18443";
const POLAR_USER = "polaruser";
const POLAR_PASS = "polarpass";


class ElectrumClient {
  endpoint;
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async getBestBlockHash() {
    console.log("[ElectrumClient.mts]: getBestBlockHash...");
    let res;
    try {
      res = (
        await ElectrumClient.get("rest/chaininfo.json")
      ).data;
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
      res = (
        await ElectrumClient.get("rest/chaininfo.json")
      ).data;
      return res.blocks;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error Getting Block Height");
    }
  }

  async getLatestBlockHeader(height: number) {
    let currentBlockHash;
    try {
      console.log("[ElectrumClient.mts]: getLatestBlockHeader, block_height:", height);
      currentBlockHash = (
        await ElectrumClient.get(
          `rest/blockhashbyheight/${height}.json`
        )
      ).data.blockhash;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error Getting Current Block Hash");
    }

    // return currentBlockHash
    console.log("[ElectrumClient.mts]: Get Latest Block Header...");
    let res;
    try {
      res = (
        await ElectrumClient.get(
          `rest/headers/1/${currentBlockHash}.hex`
        )
      ).data;
    } catch (e) {
      console.log("[ElectrumClient.mts]: Error in getting header: ", e);
    }

    if (res) {
      // console.log('BLOCK JEADER::: ',res)
      // console.log(res);
      // const blockArray = new Uint8Array(Buffer.from(JSON.stringify(res.tx)))
      return res;
    }
  }

  async getTxIdData(txid: string) {

    let res = (
      await ElectrumClient.get(`rest/tx/${txid}.json`)
    ).data;

    return { txid: res.txid, vout: res.vin[0].vout, sequence: res.vin[0].sequence };
  }

  static async get(endpoint: string, timeout_ms = TIMEOUT) {
    const axios = (await import("axios")).default;

    const url = POLAR_HOST + ":" + POLAR_PORT + "/" + endpoint;
    const config = {
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
      .post("http://" + POLAR_USER + ":" + POLAR_PASS + "@" + POLAR_HOST + ":" + POLAR_PORT + "/", options)
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
};
Object.freeze(GET_ROUTE);

export const POST_ROUTE = {
  //broadcast transaction
  TX: "/electrs/tx",
};
Object.freeze(POST_ROUTE);

export default ElectrumClient;
