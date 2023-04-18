import database from "./database";

let db: any;

if (process.env["NODE_ENV"] === "test") {
  const dbmock = require("../../test/db-mock");
  db = dbmock;
} else {
  db = database;
}

export default db;