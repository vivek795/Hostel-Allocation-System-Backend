const { ObjectId } = require('mongodb');
const mongoose = require('mongoose');

const floorSchema = new mongoose.Schema({
  floorNo : {type : Number, required: true},
  blockId : {type : mongoose.Schema.Types.ObjectId, required: true},
});

module.exports = mongoose.model('Floor', floorSchema);