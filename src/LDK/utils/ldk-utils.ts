import { getLDKClient } from "../init/getLDK.ts";
import db from "../../db/db.ts";
import * as lightningPayReq from "bolt11";
import * as ldk from "lightningdevkit";

export const closeConnections = () => {
  console.log("[ldk-utils.ts]: Closing all the connections");
  let LDK = getLDKClient();
  LDK.netHandler?.stop();
};

export const createInvoice = (
  amtInSats: number,
  invoiceExpirySecs: number,
  description: string,
  privkeyHex: string
) => {
  let mSats = ldk.Option_u64Z.constructor_some(BigInt(amtInSats * 1000));
  let min_final_cltv_expiry_delta = 36;

  let invoice = getLDKClient().channelManager.create_inbound_payment(
    mSats,
    invoiceExpirySecs,
    ldk.Option_u16Z.constructor_some(min_final_cltv_expiry_delta)
  );

  let payment_hash = invoice.res.get_a();
  let payment_secret = invoice.res.get_b();

  let encodedInvoice = lightningPayReq.encode({
    satoshis: amtInSats,
    timestamp: Date.now(),
    tags: [
      {
        tagName: "payment_hash",
        data: payment_hash,
      },
      {
        tagName: "payment_secret",
        data: payment_secret,
      },
      {
        tagName: "description",
        data: description,
      },
    ],
  });

  let signedInvoice = lightningPayReq.sign(encodedInvoice, privkeyHex);
  return signedInvoice;
};

export const saveNewPeerToDB = (
  host: string,
  port: number,
  pubkey: string
): Promise<{
  status: number;
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
            function (err: any) {
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
