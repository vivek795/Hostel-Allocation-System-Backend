const mongoose = require("mongoose");
require("dotenv").config();

mongoose.set("strictQuery", true);

const connectToMongo = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL_1, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Database Connected Successfully");
  } catch (error) {
    console.log(error);
  }
};

module.exports = connectToMongo;
