
const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  bedNo : {type : Number, required : true},
  roomNo: { type: Number , required : true},
  floorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tempLocked : {type : Boolean, default: false},
  permanentLocked: { type: Boolean, default: false }
});

module.exports = mongoose.model("Room", roomSchema);