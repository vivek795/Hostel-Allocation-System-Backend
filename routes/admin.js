const express = require("express");
const router = express.Router({ mergeParams: true, caseSensitive: true });
const { body, validationResult } = require("express-validator");
const { upload, removeFile } = require("../multer/adminMulter.js");

let parser = require("simple-excel-to-json");
const ExcelJS = require('exceljs');
const Student = require("../models/student");
const Hostel = require("../models/hostel");
const Room = require("../models/room");
const Floor = require("../models/floor");
const Block = require("../models/block");
const EmailVerify = require("../models/emailVerify");
const AcceptingRes = require("../models/acceptingRes.js");
const { sendMail } = require("../mailer");

var XLSX = require("xlsx");

// student login and otp verification

let CryptoJS = require("crypto-js");
var jwt = require("jsonwebtoken");
const crypto = require("crypto");
const student = require("../models/student");
const { monitorEventLoopDelay } = require("perf_hooks");

// router.post("/adminlogin", async (req, res) => {
//   try {
//     let { email, password } = req.body;
//     if (
//       email === process.env.ADMIN_EMAIL &&
//       password === process.env.ADMIN_PASSWORD
//     ) {
//       let adminToken = jwt.sign({ email: email }, process.env.JWT_SECRET, {
//         expiresIn: 30 * 60,
//       });

//       let value = {
//         success: true,
//         message: "Admin Logged In",
//         adminToken: adminToken,
//         email: email.toLowerCase(),
//       };
//       const encryptedObject = CryptoJS.AES.encrypt(
//         JSON.stringify(value),
//         process.env.MASTER_KEY
//       ).toString();
//       return res.status(200).json({ adminToken: adminToken });
//     } else {
//       return res.status(400).json({ message: "Incorrect email or password" });
//     }
//   } catch (err) {
//     console.log(err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });

router.post(
  "/adminOtpLogin",
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
      let { email, password } = req.body;
      let otp = Math.floor(100000 + Math.random() * 900000);
      // let otp = Math.ceil(Math.random() * Math.pow(10, 7));
      // let stud = await Student.findOne({ email: email.toLowerCase() });
      // if (!stud) return res.status(400).json({ message: "Student not found" });

      console.log(email);

      if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
        return res.status(400).json({error : "Access Denied"});
      }

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


        let value = {
          success: true,
          email: email.toLowerCase(),
        };
        
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
    // console.log("OTPS",verify.otp, otp);
    if (verify.otp == otp) {
      verify.isVerify = true;
      verify = await verify.save();
      email = email.toLowerCase();
      const adminToken = jwt.sign(
        {
          email: email,
        },
        process.env.JWT_SECRET,
        { expiresIn: 30 * 60 }
      );
     
      return res.status(200).json({ adminToken: adminToken });
      // return res.status(200).json(value);
    } else {
      return res.status(400).json({ message: "Incorrect OTP" });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// route for admin getDetails
router.post("/getDetails", async (req,res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(403).json({ errors: errors.array() });
    }
    try{
      // admin token -> 
      let { adminToken } = req.body;
      if (!adminToken) {
        return res.status(400).json({ error: "Access denied" });
      }
      else {
        try {
          // Admin token check
          let data = jwt.verify(adminToken, `${process.env.JWT_SECRET}`);
          adminId = data.email;
          if (adminId !== process.env.ADMIN_EMAIL) {
            return res.status(400).json({ error: "Access denied" });
          }

          const acceptingRes = await AcceptingRes.find();
          res.status(200).json({isAccepting: acceptingRes[0].isAccepting});

        } catch (e) {
          console.log(e);
          return res.status(400).json({ error: "Access denied" });
        }
      }
    }

    catch(e)
    {
      console.log(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
});



// route for uploading the student list
router.post(
  "/uploadstudentlist",

  // middleware

  upload.array("attachments", (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: "Unable to upload" });
    }
  }),

  async (req, res, next) => {
    // we are saving the files in the backend
    if (req.files && req.files.length !== 0) {
      req.files.forEach(function (file) {
        file.path = `${process.env.HOSTEL_WEBSITE_URL}/${file.path}`;
      });
    }
    next();
  },
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(403).json({ errors: errors.array() });
    }

    try {
      let { adminToken } = req.body;

      if (!adminToken) {
        if (req.files) {
          for (let filename of req.files) await removeFile(filename);
        }

        // console.log("hello-remove2")
        return res.status(400).json({ error: "Access denied" });
      } else {
        try {
          // Admin token check

          let data = jwt.verify(adminToken, `${process.env.JWT_SECRET}`);
          adminId = data.email;

          if (adminId !== process.env.ADMIN_EMAIL) {
            if (req.files) {
              for (let filename of req.files) await removeFile(filename);
            }

            return res.status(400).json({ error: "Access denied" });
          }
        } catch (e) {
          if (req.files) {
            for (let filename of req.files) await removeFile(filename);
          }

          console.log(e);
          return res.status(400).json({ error: "Access denied" });
        }

        // convert excel to json and add to database

        var workbook = XLSX.readFile("./uploads/" + req.files[0].filename);
        var sheet_name_list = workbook.SheetNames;
        // console.log(XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]));
        doc = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

        for (let i = 0; i < doc.length; ++i) {
          let entry = doc[i];
          const email = (entry.StudentID ? entry.StudentID.toLowerCase() : "" )+ "@mnit.ac.in";
          let isVerifyExists = await Student.findOne({
            email: email,
          });
          if (!isVerifyExists) {
            const tempBranch = entry.StudentID.substr(4, 3).toUpperCase();
            // console.log(tempBranch);
            let branch;
            switch (tempBranch) {
              case "UCP":
                branch = "CSE";
                break;
              case "UEC":
                branch = "ECE";
                break;
              case "UEE":
                branch = "EE";
                break;
              case "UME":
                branch = "ME";
                break;
              case "UCH":
                branch = "CHEM";
                break;
              case "UMT":
                branch = "META";
                break;
              case "UAR":
                branch = "ARCH";
                break;

              default:
                branch = "Unknown";
                break;
            }

            // find current year
            let currentYear = new Date().getFullYear();
            let year = currentYear - entry.StudentID.substr(0, 4) + 1;

            await Student({
              email: email,
              name: entry.Name.toUpperCase(),
              rollno: entry.StudentID.toUpperCase(),
              branch: branch,
              year: year,
              roomno: entry.roomno,
              hostel: entry.hostel ? entry.hostel.toLowerCase() : null,
              phone: entry.phone,
            }).save();
          }
        }
        res.status(200).json("Inserted Successfully !");
      }
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

//upload room list route

router.post(
  "/uploadroomlist",

  // middleware

  upload.array("attachments", (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: "Unable to upload" });
    }
  }),

  async (req, res, next) => {
    // we are saving the files in the backend
    if (req.files && req.files.length !== 0) {
      req.files.forEach(function (file) {
        file.path = `${process.env.HOSTEL_WEBSITE_URL}/${file.path}`;
      });
    }
    next();
  },
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(403).json({ errors: errors.array() });
    }

    try {
      let { adminToken } = req.body;

      if (!adminToken) {
        if (req.files) {
          for (let filename of req.files) await removeFile(filename);
        }

        // console.log("hello-remove2")
        return res.status(400).json({ error: "Access denied" });
      } else {
        try {
          // Admin token check

          let data = jwt.verify(adminToken, `${process.env.JWT_SECRET}`);
          adminId = data.email;

          if (adminId !== process.env.ADMIN_EMAIL) {
            if (req.files) {
              for (let filename of req.files) await removeFile(filename);
            }

            return res.status(400).json({ error: "Access denied" });
          }
        } catch (e) {
          if (req.files) {
            for (let filename of req.files) await removeFile(filename);
          }

          console.log(e);
          return res.status(400).json({ error: "Access denied" });
        }

        // convert excel to json and add to database

        var workbook = XLSX.readFile("./uploads/" + req.files[0].filename);
        var sheet_name_list = workbook.SheetNames;
        // console.log(XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]));
        doc = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

        // yaha se badalna hai bas

        for (let i = 0; i < doc.length; ++i) {
          let entry = doc[i];
          const roomNo = entry.RoomNo ? entry.RoomNo.toUpperCase() : "";
          // console.log(entry);

          let hostel, block, floor, room, bed;
          let roomNoArray = roomNo.split("/");

          hostel = roomNoArray[0].substr(1);
          block = roomNoArray[1];
          floor = roomNoArray[2];
          room = roomNoArray[3];
          bed = Number(roomNoArray[4].substr(1));

          let branch = entry.Branch ? entry.Branch.toUpperCase() : "NULL";
          let year = entry.Year ? entry.Year : 0;
          let hostelName = entry.Hostel ? entry.Hostel.toUpperCase() : "NULL";

          // console.log(hostel,block,floor,room,bed);

          let checkHostel = await Hostel.findOne({
            hostelNo: hostel,
            branch: branch,
            year: year,
          });
          if (!checkHostel) {
            let temp = await Hostel({
              hostelNo: hostel,
              hostelName: hostelName,
              branch: branch,
              year: year,
            });

            temp.save();
            checkHostel = temp;
          }

          let checkBlock = await Block.findOne({
            hostelId: checkHostel._id,
            block: block,
          });
          if (!checkBlock) {
            let temp = await Block({
              block: block,
              hostelId: checkHostel._id,
            });

            temp.save();
            checkBlock = temp;
          }

          let checkFloor = await Floor.findOne({
            floorNo: floor,
            blockId: checkBlock._id,
          });
          if (!checkFloor) {
            let temp = await Floor({
              floorNo: floor,
              blockId: checkBlock._id,
            });

            temp.save();
            checkFloor = temp;
          }

          let checkRoom = await Room.findOne({
            bedNo: bed,
            roomNo: room,
            floorId: checkFloor._id,
          });
          if (!checkRoom) {
            let temp = await Room({
              bedNo: bed,
              roomNo: room,
              floorId: checkFloor._id,
            });

            temp.save();
            checkRoom = temp;
          }
        }
        res.status(200).json("Inserted Successfully !");
      }
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// show requests and transactinons and student with room list with the route

/// transaction ka
// view file

router.post("/showRequests", async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(403).json({ errors: errors.array() });
  }
  try {
    let { adminToken } = req.body;

    if (!adminToken) {
      // console.log("hello-remove2")
      return res.status(400).json({ error: "Access denied" });
    } else {
      try {
        // Admin token check

        let data = jwt.verify(adminToken, `${process.env.JWT_SECRET}`);
        adminId = data.email;

        if (adminId !== process.env.ADMIN_EMAIL) {
          return res.status(400).json({ error: "Access denied" });
        }
      } catch (err) {
        console.log(err);
        return res.status(400).json({ error: "Access denied" });
      }

      const requestData = await Student.find({
        tempLocked: true,
        permanentLocked: false,
      });


      const encryptedObject = CryptoJS.AES.encrypt(
        JSON.stringify(requestData),
        process.env.MASTER_KEY
      ).toString();

      return res.status(200).json(encryptedObject);
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});




// to upload the list of students who have submitted there payments.
router.post(
  "/uploadchecklist",

  // middleware

  upload.array("attachments", (error, result) => {
    if (error) {
      console.log(error);
      res.status(400).json({ error: "Unable to upload" });
    }
  }),

  async (req, res, next) => {
    // we are saving the files in the backend-
    if (req.files && req.files.length !== 0) {
      req.files.forEach(function (file) {
        file.path = `${process.env.HOSTEL_WEBSITE_URL}/${file.path}`;
      });
    }
    next();
  },
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(403).json({ errors: errors.array() });
    }

    try {
      let { adminToken } = req.body;

      if (!adminToken) {
        if (req.files) {
          for (let filename of req.files) await removeFile(filename);
        }

        // console.log("hello-remove2")
        return res.status(400).json({ error: "Access denied" });
      } else {
        try {
          // Admin token check

          let data = jwt.verify(adminToken, `${process.env.JWT_SECRET}`);
          adminId = data.email;

          if (adminId !== process.env.ADMIN_EMAIL) {
            if (req.files) {
              for (let filename of req.files) await removeFile(filename);
            }

            return res.status(400).json({ error: "Access denied" });
          }
        } catch (e) {
          if (req.files) {
            for (let filename of req.files) await removeFile(filename);
          }

          console.log(e);
          return res.status(400).json({ error: "Access denied" });
        }

        // convert excel to json and add to database

        var workbook = XLSX.readFile("./uploads/" + req.files[0].filename);
        var sheet_name_list = workbook.SheetNames;
        // console.log(XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]));
        doc = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

        // only sutdent id should be there
        for (let i = 0; i < doc.length; ++i) {
          let entry = doc[i];

          // console.log(entry);
          const studentId = entry.studentId
            ? entry.studentId.toLowerCase()
            : "";
          console.log("student ID: ", studentId)
          const checkStudent = await Student.findOne({
            email : studentId + "@mnit.ac.in"
          });

          if (
            checkStudent &&
            checkStudent.tempLocked === true &&
            checkStudent.permanentLocked === false
          ) {
            // 1 mereko usko update kana hai
            // usko mail karna hai ki permanaent locked ho gya hai
            // cosnt std = await Student.findOne({email: studentId})
            const studentUpdateData = await Student.findOneAndUpdate(
              { email: studentId + "@mnit.ac.in" },
              { tempLocked: true, permanentLocked: true },
              { new: true }
            );

            const room = await Room.findOne({ _id: studentUpdateData.roomId });
            if (room) {
              const roomUpdateData = await Room.findOneAndUpdate(
                { _id: room._id },
                { tempLocked: true, permanentLocked: true },
                { new: true }
              );
            }

            if (studentUpdateData) {
              const email = checkStudent
                ? checkStudent.email.toLowerCase()
                : "";
              let stud = await Student.findOne({
                email: email.toLowerCase(),
              });
              console.log(email);
              const room = await Room.findOne({ _id: checkStudent.roomId });
              const msg = {
                to: email,
                subject:
                  "Hostel Room Allocation " +
                  new Date().getFullYear().toString(),
                text: `Your room no: ${room.roomNo}\nFloor: ${checkStudent.floorNo}\nBlock: ${checkStudent.block}\nHostel: ${checkStudent.hostelName} has been allocated.`,
                html: `<h2>Your room : <br> Room no: <strong>${room.roomNo}</strong> <br> Floor: <strong>${checkStudent.floorNo} </strong><br> Block: <strong>${checkStudent.block}</strong> <br> Hostel: <strong>${checkStudent.hostelName}</strong> has been allocated.</h2>`,
              };
              sendMail(msg);
            }
          }

        }
        res.status(200).json("Rooms Locked Successfully!");
      }
    } catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
);

// to unlock the selected rooms which are not pemanently locked yet.
router.post("/unlockroom", async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(403).json({ errors: errors.array() });
  }
  try {
    const { adminToken, studentArray } = req.body;

    if (!adminToken) {
      return res.status(400).json({ error: "Access Denied" });
    }
    let data = jwt.verify(adminToken, `${process.env.JWT_SECRET}`);
    adminId = data.email;

    if (!adminId||adminId !== process.env.ADMIN_EMAIL) {
      return res.status(400).json({ error: "Access denied" });
    }

    if (!studentArray) {
      return res.status(400).json({ error: "No Students Found" });
    }
    studentArray.forEach(async (studentId) => {
      // console.log("student ID", studentId);
      const std = await Student.findOne({ _id: studentId });
      console.log("StudentPrint:", std);
      const room = await Room.findOne({ _id: std.roomId });

      const studentUpdateData = await Student.findOneAndUpdate(
        { _id: studentId, tempLocked: true, permanentLocked: false },
        { tempLocked: false, permanentLocked: false, transactionId: null,  },
        { new: true }
      );

      if (room && room.tempLocked === true && room.permanentLocked === false) {
        const roomUpdateData = await Room.findOneAndUpdate(
          { _id: room._id },
          { tempLocked: false, permanentLocked: false },
          { new: true }
        );
      }

      if (studentUpdateData) {
        const email = studentUpdateData
          ? studentUpdateData.email.toLowerCase()
          : "";
        let stud = await Student.findOne({
          email: email.toLowerCase(),
        });
        console.log(email);
        const room = await Room.findOne({ _id: studentUpdateData.roomId });
        const msg = {
          to: email,
          subject:
            "Hostel Room Allocation " + new Date().getFullYear().toString(),
          text: `Your room request for the selected Room no: ${room.roomNo}\nFloor: ${studentUpdateData.floorNo}\nBlock: ${studentUpdateData.block}\nHostel: ${studentUpdateData.hostelName} has been rejected by admin due to fee due or incorrect transaction details.`,
          html: `<h2>Your room request for the selected room: <br> Room no: <strong>${room.roomNo}</strong> <br> Floor No: <strong>${studentUpdateData.floorNo}</strong> <br> Block: <strong>${studentUpdateData.block}</strong> <br> Hostel: <strong>${studentUpdateData.hostelName}</strong> has been rejected by admin due to fee due or incorrect transaction details.</h2>`,
        };
        sendMail(msg);
      }
      else{
        console.log("Email has not been sent properly")
      }
    });
    
    res.status(200).json("Rooms Unlocked Successfully!");
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});



// to lock the selected rooms permanently.
router.post("/lockroom", async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(403).json({ errors: errors.array() });
  }
  try {
    const { adminToken, studentArray } = req.body;

    if (!adminToken) {
      return res.status(400).json({ error: "Access Denied" });
    }

    if (!studentArray) {
      return res.status(400).json({ error: "No Students Found" });
    }
    studentArray.forEach(async (studentId) => {

      const std = await Student.findOne({ _id: studentId });
      console.log("StudentPrint:", std);
      const room = await Room.findOne({ _id: std.roomId });
      
      const studentUpdateData = await Student.findOneAndUpdate(
        { _id: studentId, tempLocked: true, permanentLocked: false },
        { tempLocked: true, permanentLocked: true},
        { new: true }
      );
  
      if (room && room.tempLocked === true && room.permanentLocked === false) {
        const roomUpdateData = await Room.findOneAndUpdate(
          { _id: room._id },
          { tempLocked: true, permanentLocked: true },
          { new: true }
        );
      }

      if (studentUpdateData) {
        const email = studentUpdateData
          ? studentUpdateData.email.toLowerCase()
          : "";
        let stud = await Student.findOne({
          email: email.toLowerCase(),
        });
        console.log(email);
        const room = await Room.findOne({ _id: studentUpdateData.roomId });
        const msg = {
          to: email,
          subject:
            "Hostel Room Allocation " +
            new Date().getFullYear().toString(),
            text: `Your room no: ${room.roomNo}\nFloor: ${studentUpdateData.floorNo}\nBlock: ${studentUpdateData.block}\nHostel: ${studentUpdateData.hostelName} has been allocated.`,
            html: `<h2>Your selected room :- <br> Room no: <strong>${room.roomNo}</strong> <br> Floor: <strong>${studentUpdateData.floorNo} </strong><br> Block: <strong>${studentUpdateData.block}</strong> <br> Hostel: <strong>${studentUpdateData.hostelName}</strong> has been allocated.</h2>`,
          };

          sendMail(msg);
      }

    });

    res.status(200).json("Rooms Locked Successfully!");
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});



// to download the list.
router.post("/downloadList", async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(403).json({ errors: errors.array() });
  }
  try {
    const { adminToken } = req.body;

    if (!adminToken) {
      return res.status(400).json({ error: "Access Denied" });
    }
    
    try{
      // get all student data in the array
      const studentData = await Student.find({tempLocked : true , permanentLocked : true});
      
      // save the data in an excel sheet
      let workbook = new ExcelJS.Workbook();
      let worksheet = workbook.addWorksheet("Student Data");
      worksheet.columns = [
        { header: "Name", key: "name", width: 40 },
        { header: "Email", key: "email", width: 30 },
        { header: "Phone", key: "phoneNo", width: 40 },
        { header: "Hostel Name", key: "hostelName", width: 30 },
        { header: "Floor No", key: "floorNo", width: 30 },
        { header: "Block", key: "block", width: 30 },
        { header: "Room No", key: "roomNo", width: 30 },
      ];
      worksheet.getRow(1).font = { bold: true };
      studentData.forEach(async (e, index) => {
        const rowIndex = index + 2;
        await worksheet.addRow({
          name: e?.name,
          email: e?.email,
          phoneNo: e?.phoneNo,
          hostelName: e?.hostelName,
          floorNo: e?.floorNo,
          block: e?.block,
          roomNo: e?.roomNo,
        })
        
      });
      const data = await workbook.xlsx.writeFile(__dirname+"/studentData.xlsx");
      
      // send the studentData.xlsx to frontend
      res.status(200).sendFile(__dirname+"/studentData.xlsx");

    }
    catch(err){
      console.log(err);
        return res.status(400).json({ error: "Something Went Wrong!" });
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


// to implement accepting responses.
router.post("/acceptingResponses", async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(403).json({ errors: errors.array() });
  }
  try {
    const { adminToken, isAccepting } = req.body;

    if (!adminToken) {
      return res.status(400).json({ error: "Access Denied" });
    }
    
    try{
      
      const updateResponse = await AcceptingRes.findOneAndUpdate({}, {isAccepting : isAccepting}, {new : true});
      if(updateResponse === null){
        const newResponse = await AcceptingRes.create({
          isAccepting : isAccepting
        });
      }
      
      res.status(200).json("Updated Successfully!")

    }
    catch(err){
      console.log(err);
        return res.status(400).json({ error: "Something Went Wrong!" });
    }
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});


router.post("/chooseRoomHostel", async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(403).json({ errors: errors.array() });
  }
  try {
    const { adminToken, studentId } = req.body;
    
     if (!adminToken) {
      return res.status(400).json({ error: "Access Denied" });
    }

    if(!studentId){
      return res.status(400).json({error : "Invalid Student Id"});
    }
    
    try {
      let data = jwt.verify(adminToken, `${process.env.JWT_SECRET}`);
      adminId = data.email;

      if (!adminId||adminId !== process.env.ADMIN_EMAIL) {
        return res.status(400).json({ error: "Access denied" });
      }
      const email = studentId.toLowerCase() + "@mnit.ac.in";

      const checkStudent = await Student.findOne({email : email});

      if(!checkStudent){
        res.status(400).json({error : "Student not Found!"});
      }

      const hostel = await Hostel.find({branch: checkStudent.branch , year : checkStudent.year});
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
    catch (err) {
      console.log(err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
    catch(err)
    {
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
    let { adminToken, hostelId } = req.body;

    if (!adminToken) {
      return res.status(400).json({ error: "Access denied" });
    } else {
      
      let data = jwt.verify(adminToken, `${process.env.JWT_SECRET}`);
      adminId = data.email;

      if (!adminId || adminId !== process.env.ADMIN_EMAIL) {
        return res.status(400).json({ error: "Access denied" });
      }
      let checkHostel;

      try {
        // Admin token check
        if (hostelId == null|| hostelId === "") {
          return res.status(400).json({ error: "Hostel Id required!" });
        }
        
        // console.log(studentId);
        // checkStudent = await Student.findOne({ _id: studentId });
        checkHostel = await Hostel.find({ _id: hostelId });
        // console.log(checkStudent);

        if (!checkHostel) {
          return res.status(400).json({ error: "Access denied" });
        }
      } catch (e) {
        console.log(e);
        return res.status(400).json({ error: "Access denied" });
      }

      let block = await Block.find({ hostelId: hostelId });
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
    let { adminToken, blockId } = req.body;

    if (!adminToken) {
      return res.status(400).json({ error: "Access denied" });
    } else {
      let checkBlock;
      let data = jwt.verify(adminToken, `${process.env.JWT_SECRET}`);
      adminId = data.email;

      if (!adminId||adminId !== process.env.ADMIN_EMAIL) {
        return res.status(400).json({ error: "Access denied" });
      }
      try {
        // Admin token check
        if (blockId == null||blockId === "") {
          return res.status(400).json({ error: "Block Id required!" });
        }
        
        checkBlock = await Block.find({ _id: blockId });
        // console.log(checkStudent);

        if (!checkBlock) {
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



// this is the route for choosing the room for a partiuclar.
router.post("/chooseRoom", async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(403).json({ errors: errors.array() });
  }

  try {
    let {adminToken, floorId } = req.body;

    if (!adminToken) {
      return res.status(400).json({ error: "Access denied" });
    } else {
      let data = jwt.verify(adminToken, `${process.env.JWT_SECRET}`);
      adminId = data.email;

      if (!adminId||adminId !== process.env.ADMIN_EMAIL) {
        return res.status(400).json({ error: "Access denied" });
      }
      let checkFloor;

      try {
        // Admin token check
        if (floorId == null || floorId ==="") {
          return res.status(400).json({ error: "Floor Id required!" });
        }
       
        checkFloor = await Floor.find({ _id: floorId });
        // console.log(checkStudent);

        if (!checkFloor) {
          return res.status(400).json({ error: "Access denied" });
        }
      } catch (e) {
        console.log(e);
        return res.status(400).json({ error: "Access denied" });
      }


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




// new section for students doing personal requests to admin.
router.post("/selfAddStudent", async(req,res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(403).json({ errors: errors.array() });
  }
  try{
    const {adminToken, studentMailId , roomId, transactionId } = req.body;
    
    if (!adminToken) {
      return res.status(400).json({ error: "Access Denied" });
    }
    let data = jwt.verify(adminToken, `${process.env.JWT_SECRET}`);
    adminId = data.email;

    if (!adminId||adminId !== process.env.ADMIN_EMAIL) {
      return res.status(400).json({ error: "Access denied" });
    }
    if (!studentMailId) {
      return res.status(400).json({ error: "Enter a valid Student Id" });
    }
    // if (studentMailId.length === 11 )
    // {
    //   console.log("Mail ID",studentMailId);
    //   return res.status(400).json({ error: "Enter a valid student id" });  
    // }  

    if(transactionId !== "0987654321" ){
      return res.status(400).json({ error: "Enter a valid TransactionId" });  
    }
    

    const email = studentMailId ? (studentMailId.toLowerCase() + "@mnit.ac.in"): "";
    
    const checkStudent = await Student.findOne({ email: email });
    if(!checkStudent)
    {
      return res.status(400).json({ error: "Student not found" });
    }
    const room = await Room.findOne({_id : roomId});
    const floor = await Floor.findOne({_id : room.floorId});
    const block = await Block.findOne({_id : floor.blockId});
    const hostel = await Hostel.findOne({_id: block.hostelId});
    
    const studentUpdateData = await Student.findOneAndUpdate(
      {_id : checkStudent._id},
      {
        tempLocked: true,
        permanentLocked : false,
        transactionId : transactionId,
        roomId : roomId,
        roomNo : room.roomNo,
        floorNo : floor.floorNo,
        block : block.block,
        hostelNo : hostel.hostelNo,
        hostelName : hostel.hostelName
      },
      {new : true}
    );

    console.log(studentUpdateData);

    res.status(200).json("Room Temporarily Locked!");
  } catch (e) {
    console.log(e);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});



module.exports = router;