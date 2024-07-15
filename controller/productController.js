const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const Category = require("../models/categoriesModel");
const Product = require("../models/productSchema");
const fs = require('fs'); // Import the fs module
const sharp = require("sharp");

const path = require("path");
const { log } = require("console");



const loadProductList = async (req, res) => {
  try {
    let page = 1;
    if (req.query.page) {
      page = +req.query.page;
    }
    const limit = 5;
    const products = await Product.find({})
      .populate('category', 'name') 
      .sort({ date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await Product.countDocuments();
    const categories = await Category.find({is_listed:true});

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
      categories 

    });
  } catch (err) {
    res.status(400).send("internal server error");
  }
};
// add product page load

const loadAddproduct = async (req, res) => {
    try {
      const categories = await Category.find({is_listed:true});
      res.render("addProduct", { categories: categories });
    } catch (err) {
      console.log(err.message);
    }
  };


  const listUnlistProduct = async (req, res) => {
    try {
      const productId = req.body.productId;
      const productData = await Product.findById(productId);
  
      if (!productData) {
        return res.status(404).json({ success: false, message: "Product not found" });
      }
  
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        { $set: { is_Listed: !productData.is_Listed } },
        { new: true } 
      );
  
      res.json({ success: true, is_Listed: updatedProduct.is_Listed });
    } catch (err) {
      console.log(err.message);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  };
  


  const addProduct = async (req, res) => {
    try {
      // Extract form data and process as needed
      const { name, description, category, price, quantity,gender,color } = req.body;

      let { sizes } = req.body;

      // If sizes is not an array, make it an array
      sizes = Array.isArray(sizes) ? sizes : [sizes];
  
  
 // Find the category by name
 const getCategory = await Category.findOne({ name: category});

 if (!getCategory) {
   return res.status(404).send("Category not found");
 }
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
          
        
          await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
          
          // Resize image using sharp and save to specified path
          await sharp(req.files[i].path).resize(400, 600).toFile(outputPath);
  
          // Collect filenames for images
          arrImages.push(req.files[i].filename);
        }
      }
  
      // Create new product 
      const product = new Product({
        name,
        description,
        category: getCategory._id,
        price,
        stockQuantity: quantity,
        is_Listed: true,
        // images: arrImages,
        gender,
        variants: [{
          color,
           sizes,
          quantity,
          images: arrImages
        }]
      });
  
      // Save product to MongoDB
      await product.save();
      res.redirect("/admin/products");
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal server error");
    }
  };



  const editProduct = async (req, res) => {
    try {
      const { productId, newName, newDescription, newPrice, newCategory, newGender } = req.body;
     
      // Verify product existence
      const product = await Product.findById(productId);
      if (!product) {
        console.log(`Product with ID ${productId} not found`);
        return res.status(404).send("Product not found");
      }
  
      // Update product fields
      product.name = newName;
      product.description = newDescription;
      product.price = newPrice;
      product.category = newCategory;
      product.gender = newGender;
  
      const updatedProduct = await product.save();
      if (!updatedProduct) {
        return res.status(404).send("Failed to update product");
      }
  
      // Redirect back to the product list or wherever desired after update
      res.redirect("/admin/products?success=true");
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Internal server error");
    }
  };
  
  
const loadVariant = async (req, res) => {
  try {
    const id = req.params.id;
    if (id) {
    
      const product = await Product.findOne({ _id: id }, { name: 1, variants: 1 });
      if (product) {
        console.log(JSON.stringify(product, null, 2)); // Log product data
        res.render("variantManagement", { product: product });
      } else {
        console.log("Product not found");
        res.status(404).send("Product not found");
      }
    } else {
      console.log("ID not received");
      res.status(400).send("ID not received");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

const loadAddVariant = async (req, res) => {
  try {
    const productId = req.query.id;
    console.log('Product ID received in loadAddVariant:', productId);
    const product = await Product.findOne({_id: productId});
    console.log(product);
    if (!product) {
      console.log("Product not found for ID:", productId);
      return res.status(404).send("Product not found");
    }
    res.render("addVariant", { product: product });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Internal Server Error");
  }
};

const addVariant = async (req, res) => {
  try {
    const { productId, color, quantity, sizes } = req.body;

    // Validate input
    if (!productId || !color || !quantity || !sizes) {
      return res.status(400).send("Missing required fields");
    }

    // Find the product by ID
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send("Product not found");
    }

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

        // Create directories if they don't exist
        await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });

        // Resize image using sharp and save to specified path
        try {
          await sharp(req.files[i].path).resize(400, 600).toFile(outputPath);
          // Collect filenames for images
          arrImages.push(req.files[i].filename);
        } catch (err) {
          console.error(`Error processing image ${req.files[i].filename}:`, err);
          return res.status(500).send("Error processing image");
        }
      }
    }

    // Add variant to the product
    product.variants.push({
      color,
      quantity: parseInt(quantity, 10), // Ensure quantity is a number
      sizes: Array.isArray(sizes) ? sizes : [sizes], // Ensure sizes is an array
      images: arrImages
    });

    // Save the product with the new variant
    await product.save();

    // Redirect to the variant loading page
    res.redirect(`/admin/loadVariant/${productId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error");
  }
};

const loadEditVariant = async (req, res) => {
  try {
    const index = req.query.index;
    const id = req.query.id;
    
    if (id) {
      const product = await Product.findOne({ _id: id });
      
      if (product) {
        const variant = product.variants[index];
        
        if (variant) {
          res.render("editVariant", {
            product: variant,
            id: id,
            index: index,
            data: product,
          });
        } else {
          console.log(`No variant found at index ${index}`);
          res.status(404).send("Variant not found");
        }
      } else {
        console.log(`No product found with id ${id}`);
        res.status(404).send("Product not found");
      }
    } else {
      console.log("id not received in load variant");
      res.status(400).send("Invalid request: id is required");
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Server error");
  }
};


  
const editVariant = async (req, res) => {
  try {
    const { id, index, color, quantity, sizes, existingImages } = req.body;

    if (!id || !index || !color || !quantity || !sizes) {
      return res.status(400).send('Missing required fields');
    }

    // Find the product by ID to ensure it exists
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).send('Product not found');
    }

    // Process uploaded images
    const newImages = [];
    if (req.files && req.files.length > 0) {
      for (let i = 0; i < req.files.length; i++) {
        const outputPath = path.resolve(
          __dirname,
          '..',
          'public',
          'assets',
          'images',
          'productImage',
          'sharped',
          `${req.files[i].filename}`
        );

        await sharp(req.files[i].path).resize(400, 600).toFile(outputPath);
        newImages.push(req.files[i].filename);
      }
    }

    // Get the current images from the variant
    let currentImages = product.variants[index].images;

    // Update the images array, replacing only those that are new
    let updatedImages = currentImages.map((image, idx) => {
      return newImages[idx] || existingImages[idx] || image;
    });

    // If new images are more than current images, append them
    if (newImages.length > currentImages.length) {
      updatedImages = updatedImages.concat(newImages.slice(currentImages.length));
    }

    // Update the variant details using updateOne
    await Product.updateOne(
      { _id: id, [`variants.${index}`]: { $exists: true } },
      {
        $set: {
          [`variants.${index}.color`]: color,
          [`variants.${index}.quantity`]: parseInt(quantity, 10),
          [`variants.${index}.sizes`]: Array.isArray(sizes) ? sizes : [sizes],
          [`variants.${index}.images`]: updatedImages
        }
      }
    );

    // Redirect or respond with success message
    res.redirect(`/admin/loadVariant/${id}`);
  } catch (error) {
    console.error('Error in editVariant:', error);
    res.status(500).send('Internal server error');
  }
};


const loadShop = async (req, res) => {
  try {

    const gender = req.params.gender

    const products = await Product.find({gender}).populate('variants').populate("category")
    const categories = await Category.aggregate([
      {$match:{
        gender:gender,
        is_listed:true
      }}
    ])

    res.render("shop", { products,
      categories,
      title:gender
     });

  } catch (err) {
    console.log(err.message);
    res.status(500).send("Internal Server Error");
  }
};

const productView = async (req, res) => {
  try {
    

    // Get product ID from query parameters
    const productId = req.params.productId; // Get product ID from URL parameter
    const variantId = req.params.variantId;
    // Fetch product details by ID
    const product = await Product.findById(productId).populate("variants").populate("category")

    // Handle case where product ID is not found
    if (!Product) {
      
      return res.status(404).send('Product not found');
    }

    let variant =product.variants.find((variant) => variant._id == variantId)

    if (!variant) {
      return res.status(404).send('variant not found');
    }

    const category =product.category


    // Check if category exists and log the details
    if (!category) {
      console.log(`Category not found for product ${productId}`);
    } 

    // Render product details view with product and categories data
    res.render("productDetails", {
      product,
      variant,
      category
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Internal Server Error");
  }
};


module.exports = {
    loadProductList,
    loadAddproduct,
    listUnlistProduct,
    addProduct,
    editProduct,
    loadShop,
    productView,
    loadVariant,
    loadAddVariant,
    addVariant,
    loadEditVariant,
    editVariant




}