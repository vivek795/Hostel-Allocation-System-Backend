const mongoose = require("mongoose")

const AcceptingResSchema = new mongoose.Schema({
    isAccepting: { type: Boolean, default: false },
    year: {type: Number}
});

module.exports = mongoose.model("AcceptingRes", AcceptingResSchema);