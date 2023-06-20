const multer = require("multer");
const fs = require("fs");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    const uniquePrefix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniquePrefix + "-" + file.originalname);
  },
});

//********** MULTER *******/
const upload = multer({
  storage: storage,
  // fileFilter: function (req, file, cb) {
  //   // Set the filetypes, it is optional
  //   var filetypes = /xlsx|xls/;
  //   var mimetype = filetypes.test(file.mimetype);

  //   var extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  //   if (mimetype && extname) {
  //     return cb(null, true);
  //   }

  //   cb(
  //     "Error: File upload only supports the " +
  //       "following filetypes - " +
  //       filetypes
  //   );
  // },
});

let removeFile = async (filename) => {
  try {
    fs.unlinkSync("/uploads" + "/" +  filename);
    // console.log("hello - remove");
  } catch (err) {
    console.log(err);
  }
};

module.exports = {
  // cloudinary,
  upload,
  removeFile,
};
