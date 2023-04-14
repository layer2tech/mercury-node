import LightningClient from "../LightningClient";
import initLDK from "./initialiseLDK";

let LDKClient: LightningClient;

export async function createLDK(bitcoind_client: string = "prod") {
  console.log("[getLDK.ts]: bitcoind_client settings: ", bitcoind_client);

  try {
    LDKClient = await initLDK(bitcoind_client);
  } catch (e) {
    throw Error("[getLDK.ts]: Couldn't init LDK");
  }
}

export function getLDKClient(): LightningClient {
  if (!LDKClient) {
    throw new Error("[getLDK.ts]: LDKClient is not instantiated.");
  }

  return LDKClient;
}
