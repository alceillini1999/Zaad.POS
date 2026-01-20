// Thin facade to avoid duplicated Google Sheets auth logic.
// Prefer importing from "./google/sheets" and "./google/sheets.repo" directly.
const { getSheets } = require("./google/sheets.js");
const repo = require("./google/sheets.repo.js");

module.exports = {
  getSheets,
  ...repo,
};
