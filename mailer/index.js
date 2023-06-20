const nodemailer = require("nodemailer");

let mail1 = true;

async function sendMail({ to, subject, text, html }) {
  let transporter, mailOptions;
  if (mail1) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.mailer1,
        pass: process.env.password1,
      },
    });
    mailOptions = {
      from: process.env.mailer1,
      to: to,
      subject: subject,
      text: text,
      html: html,
    };
  } else {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.mailer2,
        pass: process.env.password2,
      },
    });
    mailOptions = {
      from: process.env.mailer2,
      to: to,
      subject: subject,
      text: text,
      html: html,
    };
  }

  let flag = false;
  await transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
      flag = false;
    } else {
      mail1 = !mail1;
      flag = true;
    }
  });
  return flag;
}
async function sendMailToSome({ to, cc, bcc, subject, text, html }) {
  let transporter, mailOptions;
  if (mail1) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.mailer1,
        pass: process.env.password1,
      },
    });
    mailOptions = {
      from: process.env.mailer1,
      to: to,
      cc: cc,
      bcc: bcc,
      subject: subject,
      text: text,
      html: html,
    };
  } else {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.mailer2,
        pass: process.env.password2,
      },
    });
    mailOptions = {
      from: process.env.mailer2,
      to: to,
      cc: cc,
      bcc: bcc,
      subject: subject,
      text: text,
      html: html,
    };
  }

  let flag = false;
  await transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
      flag = false;
    } else {
      mail1 = !mail1;
      flag = true;
    }
  });
  return flag;
}

module.exports = { sendMail, sendMailToSome };