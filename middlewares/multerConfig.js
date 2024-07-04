const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(
      null,
      path.join(__dirname, "../public/assets/images/productImage"),
      function (err, success) {
        if (err) {
          throw err;
        }
      }
    );
  },
  filename: function (req, file, cb) {
    const name = Date.now() + "-" + file.originalname;

    cb(null, name, function (error, success) {
      if (error) {
        throw error;
      }
    });
  },
});

const upload = multer({ storage: storage });
module.exports = upload;