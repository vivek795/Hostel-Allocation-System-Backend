const mongoose = require("mongoose");

const emailVerifySchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    otp: {
      type: Number,
      required: true,
    },
    isVerify: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.EmailVerify ||
  mongoose.model("EmailVerify", emailVerifySchema);