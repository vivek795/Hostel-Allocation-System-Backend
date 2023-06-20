const mongoose = require('mongoose')

const hostelSchema = new mongoose.Schema({
  hostelNo: { type: Number, required: true },
  hostelName: { type: String },
  branch: { type: String, required: true },
  year: { type: Number, required: true },
});

module.exports = mongoose.model('Hostel', hostelSchema)