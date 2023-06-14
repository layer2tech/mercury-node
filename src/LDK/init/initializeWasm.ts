import * as ldk from "lightningdevkit";
import fs from "fs";

export default async function initializeWasm() {
  try {
    const wasm_file = await fs.promises.readFile("./liblightningjs.wasm");
    await ldk.initializeWasmFromBinary(wasm_file);
  } catch (e) {
    throw new Error(`[initialiseWasm.ts]: InitialiseWasmError: ${e}`);
  }
}
