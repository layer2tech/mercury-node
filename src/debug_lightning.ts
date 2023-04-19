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

  // 035ed8262d974f29af1926d2d055112e4a96d91072d18ecfefec2ec0521877d11d@127.0.0.1:9737
  // 029fb20b846d911b9aee81e7e64e46de70c52df93489465998f374fdc3e0df9845@127.0.0.1:9738

  // Polar node details
  let pubkeyHex =
    "029fb20b846d911b9aee81e7e64e46de70c52df93489465998f374fdc3e0df9845";
  let hostname = "127.0.0.1";
  let port = 9738;

  // Connect to the peer node
  console.log("[debug_lightning.ts]: Connect to Peer");
  await LightningClient.connectToPeer(pubkeyHex, hostname, port);

  // Set the TXID for the funding generation event
  // bcrt1q0zxgl8d78wpkwmpql8fcr79dds5v80237zg52s
  // txid: 6738dc075642815b67845be57a452e93909fe4c7e52e7397c2713d9b6c57387d

  LightningClient.setEventTXData("6738dc075642815b67845be57a452e93909fe4c7e52e7397c2713d9b6c57387d")

  // Connect to the channel
  let pubkey = hexToUint8Array(pubkeyHex);
  //console.log("[debug_lightning.ts]: Connect to channel");
  if (pubkey) {
    //await LightningClient.createChannel(pubkey, 100000, 0, 1, true);
  }

  //await LightningClient.forceCloseChannel("ef382090de601be8d62439d80def437503bb5a5e5c2ddc7a5aa27c4a7f3d3618");
}
