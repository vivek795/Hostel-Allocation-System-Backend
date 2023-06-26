const { Timestamp } = require("mongodb");
const mongoose = require("mongoose");

// create a student schema of the following attributes

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phoneNo: { type: Number },
  year: { type: Number, required: true },
  branch: { type: String, required: true },
  roomId: { type: mongoose.Schema.Types.ObjectId },
  tempLocked: { type: Boolean, default: false },
  permanentLocked: { type: Boolean, default: false },
  transactionId: { type: String },
  roomNo: { type: Number },
  hostelNo: { type: Number },
  hostelName: {type: String},
  block: { type: String },
  floorNo: { type: Number },
  remarks: { type: String },
  fileURL : {type: String}
});

module.exports = mongoose.model("Student", studentSchema);
