import { createMockDatabase } from "../../test/db-mock";
import { createDatabase } from "./database";

export const getDatabase = async () => {
  if (process.env["NODE_ENV"] === "test") {
    return createMockDatabase();
  } else {
    return createDatabase();
  }
};