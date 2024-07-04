const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const Category = require("../models/categoriesModel");
const Product = require("../models/productSchema");
const fs = require('fs'); // Import the fs module
const sharp = require("sharp");

const path = require("path");

const loadProductList = async (req, res) => {
  try {
    let page = 1;
    if (req.query.page) {
      page = +req.query.page;
    }
    const limit = 5;
    const products = await Product.find({})
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Product.countDocuments();

    const totalPages = Math.ceil(count / limit);
    let previous = page > 1 ? page - 1 : 1;
    let next = page + 1;
    if (next > totalPages) {
      next = totalPages;
    }
    res.render("products", {
      products: products,
      totalPages: totalPages,
      currentPage: page,
      previous: previous,
      next: next,
    });
  } catch (err) {
    res.status(400).send("internal server error");
  }
};
// add product page load

const loadAddproduct = async (req, res) => {
    try {
      const categories = await Category.find({});
      res.render("addProduct", { categories: categories });
    } catch (err) {
      console.log(err.message);
    }
  };


  const listUnlistProduct = async (req, res) => {
    try {
      const userid = req.body.list;
      const productData = await Product.findOne({ _id: userid });
      if (productData.is_Listed) {
        await Product.findByIdAndUpdate(
          {
            _id: userid,
          },
          {
            $set: {
              is_Listed: false,
            },
          }
        );
      } else {
        await Product.findByIdAndUpdate(
          {
            _id: userid,
          },
          {
            $set: {
              is_Listed: true,
            },
          }
        );
      }
      res.json({ list: true });
    } catch (err) {
      console.log(err.message);
    }
  };



  const addProduct = async (req, res) => {
    try {
      // Extract form data and process as needed
      const { name, description, category, price, sizes, quantity, previous_price } = req.body;
  
      // Process uploaded images
      let arrImages = [];
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const outputPath = path.resolve(
            __dirname,
            "..",
            "public",
            "assets",
            "images",
            "productImage",
            "sharped",
            `${req.files[i].filename}`
          );
          
          // Ensure directory exists before writing
          await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
          
          // Resize image using sharp and save to specified path
          await sharp(req.files[i].path).resize(500, 500).toFile(outputPath);
  
          // Collect filenames for images
          arrImages.push(req.files[i].filename);
        }
      }
  
      // Find category ID from MongoDB
      const getCategory = await Category.findOne({ name: category });
  
      // Create new product instance
      const product = new Product({
        name,
        description,
        category: getCategory._id,
        price,
        sizes: sizes.split(',').map(size => size.trim()), // Assuming sizes is a comma-separated string
        stockQuantity: quantity,
        is_Listed: true,
        images: arrImages,
        categorys: getCategory._id,
        previous_price
      });
  
      // Save product to MongoDB
      await product.save();
      res.redirect("/admin/products");
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal server error");
    }
  };




module.exports = {
    loadProductList,
    loadAddproduct,
    listUnlistProduct,
    addProduct


}