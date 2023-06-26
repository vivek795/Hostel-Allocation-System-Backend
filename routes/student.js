const express = require("express");
const router = express.Router({ mergeParams: true, caseSensitive: true });
const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const { upload, removeFile } = require("../multer/index.js");

const Student = require("../models/student");
const EmailVerify = require("../models/emailVerify");
const Hostel = require("../models/hostel");
const Room = require("../models/room");
const Floor = require("../models/floor");
const Block = require("../models/block");
const AcceptingRes = require("../models/acceptingRes.js");

const { sendMail } = require("../mailer");
// student login and otp verification

// import fs moudle

const fs = require("fs");
const path = require("path");
let CryptoJS = require("crypto-js");
var jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { request } = require("http");

// create a post route for student registration
router.post(
  "/register",
  [
    body("name", "Enter the correct Name").isLength({ min: 1 }).isAlpha(),
    body("email", "Enter the correct Name").isLength({ min: 3 }).isEmail(),
  ],
  async (req, res) => {
    const { name, email } = req.body;
    try {
      let finduser = await Student.findOne({ name: name, email: email });
      if (finduser) {
        return res.status(400).json({ message: "user already exists" });
      } else {
        let user = await Student.create({
          name: req.body.name.toLowerCase(),
          email: req.body.email.toLowerCase(),
          hostel: null,
          branch: req.body.branch,
          year: req.body.year,
          //   password: req.body.password,
        });
        user.save();
        res.json(user);
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// create a post route for student login

router.post(
  "/otpLogin",
  [
    body("email", "Please enter correct email address!")
      .isLength({ min: 3 })
      .isEmail(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(403).json({ errors: errors.array() });
    }
    try {
      let { email } = req.body;
      let otp = Math.floor(100000 + Math.random() * 900000);
      // let otp = Math.ceil(Math.random() * Math.pow(10, 7));
      let stud = await Student.findOne({ email: email.toLowerCase() });
      if (!stud) return res.status(400).json({ message: "Student not found" });

      console.log(email);

      const msg = {
        to: email,
        subject: "Your otp for login",
        text: `Your otp for signing in on Hostel Allocation System is ${otp}`,
        html: `<strong>Your otp for signing in on Hostel Allocation System is ${otp}</strong>`,
      };

      if (sendMail(msg)) {
        let verify = await EmailVerify.findOne({
          email: email.toLowerCase(),
        });
        if (verify) {
          verify.otp = otp;
          verify.isVerify = false;
          verify = await verify.save();
        } else {
          verify = await EmailVerify({
            email: email.toLowerCase(),
            otp: otp,
            isVerify: false,
          }).save();
        }

        console.log(stud);

        let value = {
          success: true,
          //   message: "Password reset",
          email: email.toLowerCase(),
          // _id: stud._id,
        };
        // const encryptedObject = CryptoJS.AES.encrypt(
        //   JSON.stringify(value),
        //   process.env.MASTER_KEY
        // ).toString();
        // return res.status(200).json(encryptedObject);
        return res.status(200).json(value);
      } else {
        return res
          .status(400)
          .json({ error: "Incorrect information provided" });
      }
    } catch (error) {
      console.log(error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

router.post("/otpVerify", async (req, res) => {
  try {
    let { email, otp } = req.body;

    let verify = await EmailVerify.findOne({ email: email.toLowerCase() });
    if (!verify) {
      return res.status(400).json({ message: "Email not found" });
    }
    if (verify.otp === otp) {
      verify.isVerify = true;
      verify = await verify.save();
      email = email.toLowerCase()
      const studentData = await Student.findOne({ email: email });
      const studentToken = jwt.sign(
        {
          _id: studentData._id,
        },
        process.env.JWT_SECRET,
        { expiresIn: 30 * 60 }
      );
      let room, floor, block, hostel;
      if (studentData.roomId) {
        room = await Room.findOne({ _id: studentData.roomId });
        floor = await Floor.findOne({ _id: room.floorId });
        block = await Block.findOne({ _id: floor.blockId });
        console.log("room", room, "block", block, "floor", floor)
        hostel = await Hostel.findOne({ _id: block.hostelId });
      }

      // let value = {
      //   success: true,
      //   message: "OTP verified",
      //   studentToken: studentToken,
      //   name: studentData.name,
      //   email: email.toLowerCase(),
      // };

      // const encryptedObject = CryptoJS.AES.encrypt(
      //   JSON.stringify(value),
      //   process.env.MASTER_KEY
      // ).toString();
      console.log({ studentToken: studentToken });
      return res.status(200).json({ studentToken: studentToken });
      // return res.status(200).json(value);
    } else {
      return res.status(400).json({ message: "Incorrect OTP" });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// Get student details route.
router.post("/getStudentDetails", async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  let { studentToken } = req.body;
  if (!studentToken) {
    return res.status(400).json({ error: "Access denied" });
  }
  try {
    let data = jwt.verify(studentToken, `${process.env.JWT_SECRET}`);

    const studentId = data._id;

    const studentData = await Student.findOne({ _id: studentId });
    if (!studentData) {
      return res.status(400).json({ error: "Access Denied" });
    } else {
      let room, floor, block, hostel;
      if (studentData.roomId) {
        room = await Room.findOne({ _id: studentData.roomId });
        floor = await Floor.findOne({ _id: room.floorId });
        block = await Block.findOne({ _id: floor.blockId });
        console.log("room", room, " floor: ", floor, "block", block);
        hostel = await Hostel.findOne({ _id: (block ? block.hostelId : "") });
      }

      const acceptingRes = await AcceptingRes.find();

      console.log(acceptingRes);

      let value = {
        success: true,
        message: "OTP verified",
        studentToken: studentToken,
        name: studentData.name,
        email: studentData.email.toLowerCase(),
        phone: studentData.phoneNo,
        yearBatch: studentData.yearBatch,
        tempLocked: studentData.tempLocked,
        permanentLocked: studentData.permanentLocked,
        hostel: hostel ? hostel.hostelName : "",
        block: block ? block.block : "",
        floor: floor ? floor.floorNo : -1,
        room: room ? room.roomNo : -1,
        bedNo: room ? room.bedNo : -1,
        isAccepting : acceptingRes[0].isAccepting
      };

      const encryptedObject = CryptoJS.AES.encrypt(
        JSON.stringify(value),
        process.env.MASTER_KEY
      ).toString();
      // console.log({ studentToken: studentToken });
      return res.status(200).json(encryptedObject);
      // return res.status(200).json(value);
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// choose room route for student.
router.post("/chooseRoomHostel", async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(403).json({ errors: errors.array() });
  }

  try {
    let { studentToken } = req.body;

    if (!studentToken) {
      return res.status(400).json({ error: "Access denied" });
    } else {
      let checkStudent;

      try {
        // Admin token check

        let data = jwt.verify(studentToken, `${process.env.JWT_SECRET}`);
        // console.log(data);
        const studentId = data._id;
        // console.log(studentId);
        checkStudent = await Student.findOne({ _id: studentId });
        // console.log(checkStudent);

        const acceptingRes = await AcceptingRes.find();

        if ((acceptingRes[0].isAccepting === false) || !checkStudent || (checkStudent.tempLocked && checkStudent.tempLocked === true) || (checkStudent.permanentLocked && checkStudent.permanentLocked === true)) {
          return res.status(400).json({ error: "Access denied" });
        }
      } catch (e) {
        console.log(e);
        return res.status(400).json({ error: "Access denied" });
      }

      // find availaible hostel for this student.

      // student hai -> year , branch

      // console.log(checkStudent);
      const branch = checkStudent.branch;
      const year = checkStudent.year;

      const hostel = await Hostel.find({ branch: branch, year: year });
      // console.log(hostel);

      if (hostel) {
        const encryptedObject = CryptoJS.AES.encrypt(
          JSON.stringify(hostel),
          process.env.MASTER_KEY
        ).toString();
        return res.status(200).json(encryptedObject);
      } else {
        return res.status(400).json({ error: "No Hostel Found" });
      }
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// choose room route for student.
router.post("/chooseRoomBlock", async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(403).json({ errors: errors.array() });
  }

  try {
    let { studentToken, hostelId } = req.body;

    if (!studentToken) {
      return res.status(400).json({ error: "Access denied" });
    } else {
      let checkStudent, checkHostel;

      try {
        // Admin token check
        if (hostelId == null|| hostelId ==="") {
          return res.status(400).json({ error: "Hostel Id required!" });
        }
        let data = jwt.verify(studentToken, `${process.env.JWT_SECRET}`);
        // console.log(data);
        const studentId = data._id;
        // console.log(studentId);
        checkStudent = await Student.findOne({ _id: studentId });
        checkHostel = await Hostel.find({ _id: hostelId });
        // console.log(checkStudent);

        if (!checkStudent || !checkHostel) {
          return res.status(400).json({ error: "Access denied" });
        }
      } catch (e) {
        console.log(e);
        return res.status(400).json({ error: "Access denied" });
      }

      let block = await Block.find({ hostelId: hostelId });
      // find availaible block for this student and corresponding hostelId.
      // console.log(checkStudent);
      // console.log(block);

      if (block) {
        const encryptedObject = CryptoJS.AES.encrypt(
          JSON.stringify(block),
          process.env.MASTER_KEY
        ).toString();
        return res.status(200).json(encryptedObject);
      } else {
        return res.status(400).json({ error: "No Block Found" });
      }
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// choosing the room floor by student token and block id

router.post("/chooseRoomFloor", async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(403).json({ errors: errors.array() });
  }

  try {
    let { studentToken, blockId } = req.body;

    if (!studentToken) {
      return res.status(400).json({ error: "Access denied" });
    } else {
      let checkStudent, checkBlock;

      try {
        // Admin token check
        if (blockId == null||blockId === "") {
          return res.status(400).json({ error: "Block Id required!" });
        }
        let data = jwt.verify(studentToken, `${process.env.JWT_SECRET}`);
        // console.log(data);
        const studentId = data._id;
        // console.log(studentId);
        checkStudent = await Student.findOne({ _id: studentId });
        checkBlock = await Block.find({ _id: blockId });
        // console.log(checkStudent);

        if (!checkStudent || !checkBlock) {
          return res.status(400).json({ error: "Access denied" });
        }
      } catch (e) {
        console.log(e);
        return res.status(400).json({ error: "Access denied" });
      }

      // find availaible block for this student and corresponding hostelId.
      let floor = await Floor.find({ blockId: blockId });
      // console.log(checkStudent);
      console.log(floor);

      if (floor) {
        const encryptedObject = CryptoJS.AES.encrypt(
          JSON.stringify(floor),
          process.env.MASTER_KEY
        ).toString();
        return res.status(200).json(encryptedObject);
      } else {
        return res.status(400).json({ error: "No Floor Found" });
      }
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// this is the route for choosing the room for a partiuclar
router.post("/chooseRoom", async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(403).json({ errors: errors.array() });
  }

  try {
    let { studentToken, floorId } = req.body;

    if (!studentToken) {
      return res.status(400).json({ error: "Access denied" });
    } else {
      let checkStudent, checkFloor;

      try {
        // Admin token check
        if (floorId == null || floorId ==="") {
          return res.status(400).json({ error: "Floor Id required!" });
        }
        let data = jwt.verify(studentToken, `${process.env.JWT_SECRET}`);
        // console.log(data);
        const studentId = data._id;
        // console.log(studentId);
        checkStudent = await Student.findOne({ _id: studentId });
        checkFloor = await Floor.find({ _id: floorId });
        // console.log(checkStudent);

        if (!checkStudent || !checkFloor) {
          return res.status(400).json({ error: "Access denied" });
        }
      } catch (e) {
        console.log(e);
        return res.status(400).json({ error: "Access denied" });
      }

      // find availaible block for this student and corresponding hostelId.
      // console.log(checkStudent);
      let room = await Room.find({ floorId: floorId , tempLocked : false, permanentLocked : false});
      console.log(room);

      if (room) {
        const encryptedObject = CryptoJS.AES.encrypt(
          JSON.stringify(room),
          process.env.MASTER_KEY
        ).toString();
        return res.status(200).json(encryptedObject);
      } else {
        return res.status(400).json({ error: "No Room Found" });
      }
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// this is the route for proceeding after the room select.
// router.post("/proceed", async (req, res) => {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(403).json({ errors: errors.array() });
//   }

//   try {
//     let { studentToken, roomId } = req.body;

//     if (!studentToken) {
//       return res.status(400).json({ error: "Access denied" });
//     } else {
//       let checkStudent, checkRoom;

//       try {
//         // Admin token check

//         let data = jwt.verify(studentToken, `${process.env.JWT_SECRET}`);
//         // console.log(data);
//         const studentId = data._id;
//         // console.log(studentId);
//         checkStudent = await Student.findOne({ _id: studentId });
//         checkRoom = await Room.find({ _id: roomId });
//         // console.log(checkStudent);

//         if (!checkStudent || !checkRoom) {
//           return res.status(400).json({ error: "Access denied" });
//         } else if (checkRoom.tempLocked || checkRoom.permanentLocked) {
//           return res.status(400).json({ error: "Room already Taken" });
//         } else {
//           checkRoom.tempLocked = true;
//           checkRoom.permanentLocked = false;
//           checkRoom.save();

//           return res.status(200).json({ message: "Room Temporary Locked" });
//         }
//       } catch (e) {
//         console.log(e);
//         return res.status(400).json({ error: "Access denied" });
//       }
//     }
//   } catch (err) {
//     console.log(err);
//     return res.status(500).json({ error: "Internal Server Error" });
//   }
// });

// checkRoute
// router.post("/timeout", async (req, res) => {

//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return res.status(403).json({ errors: errors.array() });
//   }

//   try {
//     let { studentToken } = req.body;

//     if (!studentToken) {
//       return res.status(400).json({ error: "Access denied" });
//     } else {
//       let checkStudent;

//       try {
//         // Admin token check

//         let data = jwt.verify(studentToken, `${process.env.JWT_SECRET}`);
//         // console.log(data);
//         const studentId = data._id;
//         // console.log(studentId);
//         checkStudent = await Student.findOne({ _id: studentId });

//         if (!checkStudent) {
//           return res.status(400).json({ error: "Access denied" });
//         } else {

//           const {studentToken} = req.body;

//           checkStudent.lastTime = new Date().getTime().toLocaleString();
//           checkStudent.save();

//           setTimeout(async () => {
//             const data = jwt.verify(studentToken, `${process.env.JWT_SECRET}`);
//             // console.log(data);
//             const studentId = data._id
//             // console.log(studentId);
//             checkStudent = await Student.findOne({ _id: studentId });

//             if(checkStudent.lastTime !== null ){
//               checkStudent.tempLocked = false;
//               checkStudent.permanentLocked = false;
//               checkStudent.lastTime = null;

//               checkStudent.save();
//             }
//           },30*60);

//           return res.status(200).json({ message: "Room Temporary Locked" });
//         }
//       } catch (e) {
//         console.log(e);
//         return res.status(400).json({ error: "Access denied" });
//       }
//     }
//   } catch (err) {
//     console.log(err);
//     return res.status(500).json({ error: "Internal Server Error" });
//   }

// });

// to handle the transaction submit route.
router.post(
  "/transactionSubmit",
  upload.array("attachments", (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: "Unable to upload" });
    }
  }),

  async (req, res, next) => {
    
    // console.log("Multer request:", req);

    if (req.files && req.files.length !== 0) {
      req.files.forEach(function (file) {
        file.path = `${process.env.HOSTEL_WEBSITE_URL}/${file.path}`;
      });
    }
    
    next();
  },
  async (req, res) => {
    // const session = await mongoose.startSession();
    // session.startTransaction();
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(403).json({ errors: errors.array() });
    }
    
    try {
      let { studentToken, transactionId, roomId, remarks } = req.body;
      console.log("room id", req.body);
      if (!studentToken) {
        if (req.files) {
          for (let file of req.files) await removeFile(file.filename);
        }

        
        return res.status(400).json({ error: "Access denied" });
      } else if (!roomId) {
        if (req.files) {
          for (let file of req.files) await removeFile(file.filename);
        }
        return res.status(400).json({ error: "RoomId Invalid!" });
      } else if (!transactionId) {
        if (req.files) {
          for (let file of req.files) await removeFile(file.filename);
        }
        return res.status(400).json({ error: "TransactionId Invalid!" });
      } else {
        let checkStudent, checkRoom;

        try {
          // Admin token check
          console.log(studentToken)
          let data = jwt.verify(studentToken, `${process.env.JWT_SECRET}`);
          // console.log(data);
          const studentId = data._id;
          // console.log(studentId);
          checkStudent = await Student.findOne({ _id: studentId });
          // console.log(checkStudent);

          checkRoom = await Room.findOne({ _id: roomId });
          // console.log(checkStudent);
          console.log(checkRoom);

          if (!checkStudent || !checkRoom) {
            if (req.files) {
              for (let file of req.files) await removeFile(file.filename);
            }

            
            return res.status(400).json({ error: "Access denied" });
          } else if (
            checkRoom.tempLocked === true ||
            checkRoom.permanentLocked === true
          ) {
            if (req.files) {
              for (let file of req.files) await removeFile(file.filename);
            }

            return res.status(400).json({ error: "Room already Taken" });
          } else {
            // checkRoom.tempLocked = true;
            // checkRoom.permanentLocked = false;
            // checkRoom.transactionId = transactionId;
            // checkRoom.save();
            console.log(
              "room id",
              roomId,
              " templocked: ",
              checkRoom.tempLocked
            );
            // create an update statement to update operation of room
            const updateRoom = {
              tempLocked: true,
              permanentLocked: false
            };
            // console.log(updateRoom);
            // console.log(roomId);

            // update the room
            const updateRoomData = await Room.findOneAndUpdate(
              { _id: roomId },
              updateRoom,
              { new: true }
            );

            const filePathArray = req.files.map(file => file.path);
            const filePath = filePathArray[0];
            
            
            const floor = await Floor.findOne({ _id: updateRoomData.floorId });
            const blockk = await Block.findOne({ _id: floor.blockId });
            const hostel = await Hostel.findOne({ _id: blockk.hostelId });
            
            const studentUpdateData = await Student.findOneAndUpdate(
              {_id : studentId},
              {
                roomId: roomId, tempLocked: true, transactionId: transactionId, permanentLocked: false, roomNo: updateRoomData.roomNo,
                hostelNo: hostel.hostelNo, hostelName: hostel.hostelName, block: blockk.block, floorNo: floor.floorNo,
                fileURL : filePath, remarks: remarks
              }
              ,{new : true}
            );

            console.log("Room Updated : ",updateRoomData);
            console.log("Student Updated : " ,studentUpdateData)

            // await session.commitTransaction();
            return res.status(200).json({ message: "Room Temporarily Locked" });
          }
        } catch (e) {
          if (req.files) {
            for (let file of req.files) await removeFile(file.filename);
          }
          // await session.abortTransaction();

          console.log(e);
          return res.status(400).json({ error: "Access denied" });
        }
      }
    } catch (e) {
      console.log(e);
      // await session.abortTransaction();
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);


// for the student who haven't uplaoded the fee reciept! and has the family condition

router.post("/specialCase",upload.array("attachments", (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: "Unable to upload" });
    }
  }),

  async (req, res, next) => {
    // we are saving the files in the backend
    // idhar karde 
    // console.log("Multer request:", req);

    // req.body.originalname =  
    if (req.files && req.files.length !== 0) {
      req.files.forEach(function (file) {
        file.path = `${process.env.HOSTEL_WEBSITE_URL}/${file.path}`;
      });
    }
    next();
  },
  async (req, res) => {
    // const session = await mongoose.startSession();
    // session.startTransaction();
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(403).json({ errors: errors.array() });
    }

    try {
      let { studentToken, transactionId, roomId, reason } = req.body;
      console.log("room id", req.body)
      if (!studentToken) {
        if (req.files) {
          for (let file of req.files) await removeFile(file.filename);
        }

        return res.status(400).json({ error: "Access denied" });
      } else if (!roomId) {
        if (req.files) {
          for (let file of req.files) await removeFile(file.filename);
        }
        return res.status(400).json({ error: "RoomId Invalid!" });
      } else if (!transactionId) {
        if (req.files) {
          for (let file of req.files) await removeFile(file.filename);
        }
        return res.status(400).json({ error: "TransactionId Invalid!" });
      } else {
        let checkStudent, checkRoom;

        try {
          // Admin token check

          let data = jwt.verify(studentToken, `${process.env.JWT_SECRET}`);
          // console.log(data);
          const studentId = data._id;
          // console.log(studentId);
          checkStudent = await Student.findOne({ _id: studentId });
          // console.log(checkStudent);

          checkRoom = await Room.findOne({ _id: roomId });
          // console.log(checkStudent);
          console.log(checkRoom);

          if (!checkStudent || !checkRoom) {
            if (req.files) {
              for (let file of req.files) await removeFile(file.filename);
            }

            return res.status(400).json({ error: "Access denied" });
          } else if (
            checkRoom.tempLocked === true ||
            checkRoom.permanentLocked === true
          ) {
            if (req.files) {
              for (let file of req.files) await removeFile(file.filename);
            }

            return res.status(400).json({ error: "Room already Taken" });
          } else {
            // checkRoom.tempLocked = true;
            // checkRoom.permanentLocked = false;
            // checkRoom.transactionId = transactionId;
            // checkRoom.save();
            console.log(
              "room id",
              roomId,
              " templocked: ",
              checkRoom.tempLocked
            );
            // create an update statement to update operation of room
            const updateRoom = {
              tempLocked: true,
              permanentLocked: false,
              feeDeposited: false
            };
            // console.log(updateRoom);
            // console.log(roomId);

            // update the room
            const updateRoomData = await Room.findOneAndUpdate(
              { _id: roomId },
              updateRoom,
              { new: true }
            );
            const floor = await Floor.findOne({ _id: updateRoomData.floorId });
            const blockk = await Block.findOne({ _id: floor.blockId });
            const hostel = await Hostel.findOne({ _id: blockk.hostelId });
            
            const studentUpdateData = await Student.findOneAndUpdate(
              {_id : studentId},
              {
                roomId: roomId, tempLocked: true, transactionId: transactionId, permanentLocked: false, roomNo: updateRoomData.roomNo,
                hostelNo: hostel.hostelNo, hostelName: hostel.hostelName, block: blockk.block, floorNo: floor.floorNo, reason: reason, feeDeposited: false
              }
              ,{new : true}
            );

            console.log("Room Updated : ",updateRoomData);
            console.log("Student Updated : " ,studentUpdateData)

            // await session.commitTransaction();
            return res.status(200).json({ message: "Room Temporarily Locked" });
          }
        } catch (e) {
          if (req.files) {
            for (let file of req.files) await removeFile(file.filename);
          }
          // await session.abortTransaction();

          console.log(e);
          return res.status(400).json({ error: "Access denied" });
        }
      }
    } catch (e) {
      console.log(e);
      // await session.abortTransaction();
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

module.exports = router;
