import LDKClientFactory from "../init/LDKClientFactory";
import db from "../../db/db";

export const closeConnections = () => {
  console.log("[ldk-utils.ts]: Closing all the connections");
  let LDK = LDKClientFactory.getLDKClient();
  LDK.netHandler?.stop();
};

export const validateInvoiceBody = (
  amount_in_sats: any,
  invoice_expiry_secs: any,
  description: any
) => {
  if (amount_in_sats === undefined) {
    throw new Error("Undefined amount_in_sats given.");
  } else if (typeof amount_in_sats !== "number" || isNaN(amount_in_sats)) {
    throw new Error(
      "Invalid amount_in_sats given. Must be a number that can be converted to a BigInt."
    );
  }

  if (invoice_expiry_secs === undefined) {
    throw new Error("Undefined invoice_expiry_secs given.");
  } else if (
    typeof invoice_expiry_secs !== "number" ||
    isNaN(invoice_expiry_secs)
  ) {
    throw new Error("Invalid invoice_expiry_secs given. Must be a number.");
  }

  if (description === undefined) {
    throw new Error("Undefined description given.");
  } else if (typeof description !== "string") {
    throw new Error("Invalid description given. Must be a string.");
  }
};

export const saveNewPeerToDB = (
  host: string,
  port: number,
  pubkey: string
): Promise<{
  channel_id?: {
    status: number;
    message?: string;
    error?: string;
    peer_id?: number;
  };
  status?: number;
  message?: string;
  error?: string;
  peer_id?: number;
}> => {
  console.log("[ldk-utils.ts] - saveNewPeerToDB");
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id FROM peers WHERE host = ? AND port = ? AND pubkey = ?`,
      [host, port, pubkey],
      (err: any, row: any) => {
        if (err) {
          console.log(
            `[ldk-utils.ts->saveNewPeerToDB] - Error occurred during select: ${err}`
          );
          reject({ status: 500, error: "Failed to query database" });
        } else if (row) {
          console.log(
            `[ldk-utils.ts->saveNewPeerToDB] - Error occurred peer exists in database: ${row}`
          );
          resolve({
            status: 409,
            message: "Peer already exists in the database",
            peer_id: row.id,
          });
        } else {
          db.run(
            `INSERT INTO peers (host, port, pubkey) VALUES (?,?,?)`,
            [host, port, pubkey],
            function (this: any, err: any, row: any) {
              console.log(
                `[ldk-utils.ts->saveNewPeerToDB] - inserting into peers: host:${host}, port:${port}, pubkey:${pubkey}`
              );
              if (err) {
                console.log(
                  `[ldk-utils.ts] - Error occurred during insert: ${err}`
                );
                reject({
                  status: 500,
                  error: "Failed to insert peers into database",
                });
              } else {
                console.log(
                  `[ldk-utils.ts->saveNewPeerToDB] - Successful insert`
                );
                const lastID = this.lastID;
                console.log(
                  `[ldk-utils.ts->saveNewPeerToDB] - result:${lastID}`
                );
                if (lastID !== undefined) {
                  resolve({
                    status: 201,
                    message: "Peer added to database",
                    peer_id: lastID,
                  });
                } else {
                  reject({
                    status: 500,
                    error: "Failed to retrieve peer ID",
                  });
                }
              }
            }
          );
        }
      }
    );
  });
};

export const saveNewChannelToDB = (
  name: string,
  amount: number,
  push_msat: number,
  channelType: boolean,
  wallet_name: string,
  peer_id: number,
  privkey: string, // Private key from txid address
  paid: boolean,
  payment_address: string
): Promise<{
  status: number;
  message?: string;
  error?: string;
  channel_id?: number;
}> => {
  console.log("[ldk-utils.ts] - saveNewChannelToDB");
  return new Promise((resolve, reject) => {
    let channelId: number;
    db.get(
      `SELECT id FROM channels WHERE peer_id = ?`,
      [peer_id],
      (err: any, row: any) => {
        if (err) {
          reject({
            status: 500,
            error: "Failed to query database" + err,
          });
        } else if (row) {
          resolve({
            status: 409,
            message: "Channel already exists with this peer",
          });
        } else {
          const insertData = `INSERT INTO channels (name, amount, push_msat, public, wallet_name, peer_id, privkey, paid, payment_address) VALUES (?,?,?,?,?,?,?,?,?)`;
          db.run(
            insertData,
            [
              name,
              amount,
              push_msat,
              channelType,
              wallet_name,
              peer_id,
              privkey,
              paid,
              payment_address,
            ],
            function (err: any, result: any) {
              if (err) {
                reject({
                  status: 500,
                  error: "Failed to insert channel into database" + err,
                });
              } else {
                db.get(
                  `SELECT last_insert_rowid() as channel_id`,
                  (err: any, row: any) => {
                    if (err) {
                      reject({
                        status: 500,
                        error: "Failed to get last inserted channel ID",
                      });
                    } else {
                      channelId = row.channel_id;
                      resolve({
                        status: 201,
                        message: "Channel saved successfully",
                        channel_id: channelId,
                      });
                    }
                  }
                );
              }
            }
          );
        }
      }
    );
  });
};

export const saveTxDataToDB = (
  amount: number,
  paid: boolean,
  txid: string,
  vout: number,
  addr: string
): Promise<{
  status: number;
  message?: string;
  error?: string;
  channel_id: number;
  channel_type: boolean;
  push_msat: number;
  priv_key: string;
}> => {
  console.log("[ldk-utils.ts] - insertTxDataToDB");
  console.log(
    `[ldk-utils.ts] - values: amount:${amount}, paid:${paid}, txid:${txid}, vout:${vout}, addr:${addr}`
  );
  return new Promise((resolve, reject) => {
    const updateData =
      "UPDATE channels SET amount=?, paid=?, txid=?, vout=? WHERE payment_address=?";
    db.run(
      updateData,
      [amount, paid, txid, vout, addr],
      function (err: any, result: any) {
        if (err) {
          reject({
            status: 500,
            error: "Failed to insert tx data into database " + err,
          });
        }
      }
    );

    console.log("Tx data inserted");
    const getData = `SELECT id, public, push_msat, privkey FROM channels WHERE payment_address=?`;
    db.get(getData, [addr], (err: any, row: any) => {
      if (err) {
        reject({
          status: 500,
          error: "Failed to get channel data " + err,
        });
      } else if (!row) {
        reject({
          status: 404,
          error: "No channel found for payment address " + addr,
        });
      } else {
        resolve({
          status: 201,
          message: "Channel saved and updated successfully",
          channel_id: row.id,
          channel_type: row.public,
          push_msat: row.push_msat,
          priv_key: row.privkey,
        });
      }
    });
  });
};

export const saveChannelIdToDb = (
  channelId: string,
  address: string
) => {
  console.log("[ldk-utils.ts] - saveChannelIdToDB");
  console.log(
    `[ldk-utils.ts] - values: channelId:${channelId}, addr:${address}`
  );
  const updateData =
      "UPDATE channels SET channel_id=? WHERE payment_address=?";
  db.run(
    updateData,
    [channelId, address],
    function (err: any, result: any) {
      if (err) {
        console.log("Error in saving channelId to db: " + err);
      }
    }
  );
};

export const deleteChannelById = (
  channelId: number
): Promise<{
  status: number;
  message?: string;
  error?: string;
}> => {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM channels WHERE id = ?`,
      [channelId],
      function (err: any) {
        if (err) {
          reject({
            status: 500,
            error: "Failed to delete channel from database",
          });
        } else {
          resolve({
            status: 200,
            message: "Channel deleted successfully",
          });
        }
      }
    );
  });
};

export const deleteChannelByPaymentAddr = (
  addr: string
): Promise<{
  status: number;
  message?: string;
  error?: string;
}> => {
  return new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM channels WHERE payment_address = ?`,
      [addr],
      function (err: any) {
        if (err) {
          reject({
            status: 500,
            error: "Failed to delete channel from database",
          });
        } else {
          resolve({
            status: 200,
            message: "Channel deleted successfully",
          });
        }
      }
    );
  });
};
