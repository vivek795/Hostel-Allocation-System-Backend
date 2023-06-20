const mongoose = require("mongoose");

const BlockSchema = new mongoose.Schema({
  block: { type: String, required: true},
  hostelId: { type: mongoose.Schema.Types.ObjectId, required: true },
});

module.exports = mongoose.model("Block", BlockSchema);