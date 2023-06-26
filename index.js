// create backend server

const express = require('express');
const fs = require('fs');
const app = express();
const mongoSanitize = require("express-mongo-sanitize");
const path = require("node:path");
const dirname = path.resolve();

const cors = require('cors');

let PORT = 5000;

// connect to database
const connectToMongo = require("./database");
connectToMongo();

// usage of app
const bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());

// routes
app.use(mongoSanitize());
app.use("/student", require("./routes/student"));
app.use("/admin", require("./routes/admin"));
app.use(
  mongoSanitize({
    replaceWith: "_",
    allowDots: true,
  })
);

// app.use("/uploads/:file", async(req, res) => {
//   const file = req.params.file;
//   try{
//     const fileObject = fs.readFileSync(`./uploads/${file}`);
//     return res.send(fileObject);
//   }
//   catch(error){
//     console.log(error);
//     return res.status(404);
//   }

// });


app.use("/uploads", express.static(path.join(dirname, "/uploads")));


// connect to server
app.listen(PORT, function () {
    console.log("Server is running on Port: " + PORT);
}
);