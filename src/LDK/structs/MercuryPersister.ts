import fs from "fs";
import {
  ChannelManager,
  NetworkGraph,
  PersisterInterface,
  Result_NoneErrorZ,
  WriteableScore,
} from "lightningdevkit";

class MercuryPersister implements PersisterInterface {
  private rootPath: string;

  constructor(_walletName: string) {
    this.rootPath = "./wallets/" + _walletName;

    if (!fs.existsSync(this.rootPath)) {
      fs.mkdirSync(this.rootPath);
    }
  }

  persist_manager(channel_manager: ChannelManager): Result_NoneErrorZ {
    let data = channel_manager.write();
    let tempFilePath = this.rootPath + "/channel_manager_data_temp.bin";
    try {
      const buffer = Buffer.from(data);

      // Write data to a temporary file
      fs.writeFileSync(tempFilePath, buffer);

      // Rename the temporary file to the final file name
      fs.renameSync(tempFilePath, this.rootPath + "/channel_manager_data.bin");

      return Result_NoneErrorZ.constructor_ok();
    } catch (e: any) {
      // Handle any errors and delete the temporary file if it exists
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      return Result_NoneErrorZ.constructor_err(e);
    }
  }
  persist_graph(network_graph: NetworkGraph): Result_NoneErrorZ {
    let data = network_graph.write();
    let tempFilePath = this.rootPath + "/network_graph_data_temp.bin";
    try {
      const buffer = Buffer.from(data);

      // Write data to a temporary file
      fs.writeFileSync(tempFilePath, buffer);

      // Rename the temporary file to the final file name
      fs.renameSync(tempFilePath, this.rootPath + "/network_graph_data.bin");

      return Result_NoneErrorZ.constructor_ok();
    } catch (e: any) {
      // Handle any errors and delete the temporary file if it exists
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      return Result_NoneErrorZ.constructor_err(e);
    }
  }

  persist_scorer(scorer: WriteableScore): Result_NoneErrorZ {
    let data = scorer.write();
    let tempFilePath = this.rootPath + "/writable_score_data_temp.bin";
    try {
      // write to disk
      const buffer = Buffer.from(data);

      // Write data to a temporary file
      fs.writeFileSync(tempFilePath, buffer);

      // Rename the temporary file to the final file name
      fs.renameSync(tempFilePath, this.rootPath + "/writable_score_data.bin");

      return Result_NoneErrorZ.constructor_ok();
    } catch (e: any) {
      // Handle any errors and delete the temporary file if it exists
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      return Result_NoneErrorZ.constructor_err(e);
    }
  }
}

export default MercuryPersister;
