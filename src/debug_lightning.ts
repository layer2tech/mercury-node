import initialiseWasm from "./LDK/init/initialiseWasm.js";
import { getLDKClient, createLDK } from "./LDK/init/getLDK.js";
import { hexToUint8Array } from "./LDK/utils/utils.ts";

export async function debug_lightning() {
  console.log("[debug_lightning.ts]: running");

  await initialiseWasm();

  console.log("[debug_lightning.ts]: import LDK");
  await createLDK("dev");

  console.log("[debug_lightning.ts]: getLDKClient");
  const LightningClient = await getLDKClient();

  console.log("[debug_lightning.ts]: start LDK");
  await LightningClient.start();

  console.log("[debug_lightning.ts]: getBlockHeight");
  let blockHeight = await LightningClient.getBlockHeight();

  console.log("[debug_lightning.ts]: getBestBlockHash");
  let bestBlockHash = await LightningClient.getBestBlockHash();

  // Polar node details
  let pubkeyHex =
    "020d9960fec51d7f79c26c079915ae4528901b83bd79e3f0254d1a7d34c68a44fd";
  let hostname = "127.0.0.1";
  let port = 9735;

  // Connect to the peer node
  console.log("[debug_lightning.ts]: Connect to Peer");
  await LightningClient.connectToPeer(pubkeyHex, hostname, port);

  // Set the TXID for the funding generation event
  // funding TXID details:
  // bcrt1qgqq3tt4d49kx48y48dvy9q9tq7ztkgeu9h652t
  // TXID: 475c03424f7eb06131c437cccaa29a64fa44b04f30cca1bac88bd6ed7ff322ca
  // Amount inside: 1.0BTC
  //LightningClient.setEventTXData("475c03424f7eb06131c437cccaa29a64fa44b04f30cca1bac88bd6ed7ff322ca")

  // Connect to the channel
  let pubkey = hexToUint8Array(pubkeyHex);
  //console.log("[debug_lightning.ts]: Connect to channel");
  if (pubkey) {
    //await LightningClient.connectToChannel(pubkey, 100000, 0, 1, true);
  }
}
