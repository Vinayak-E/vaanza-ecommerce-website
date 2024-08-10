const User = require("../model/usersModel");
const Category = require("../model/categoriesModel");
const Product = require("../model/productsModel");
const Brand = require("../model/brandsModel");
const Cart = require("../model/cartModel");
const Order = require("../model/ordersModel");
const Coupon = require("../model/couponsModel");
const Offer = require("../model/offersModel");
const Admin = require("../model/adminModel");
const sharp = require('sharp');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const generatePDF = (reportData) => {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        let buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
            const pdfBuffer = Buffer.concat(buffers);
            resolve(pdfBuffer);
        });

        doc.text('Sales Report', { align: 'center', underline: true });

        doc.moveDown();
        doc.text(`Total Orders: ${reportData.totalOrders}`);
        doc.text(`Total Sales Amount: ${reportData.totalSales}`);
        doc.text(`Total Discounts: ${reportData.totalDiscounts}`);
        doc.moveDown();

        reportData.orders.forEach(order => {
            doc.text(`Order ID: ${order.orderId}`);
            doc.text(`Order Date: ${new Date(order.orderDate).toLocaleDateString()}`);
            doc.text(`Total Amount: ${order.totalAmount}`);
            doc.text(`Discount: ${order.discountAmount}`);
            doc.text('Products:');
            order.products.forEach(product => {
                doc.text(`- ${product.productName}: ${product.quantity} x ${product.price}`);
            });
            doc.moveDown();
        });

        doc.end();
    });
};

const generateExcel = async (reportData) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Sales Report');

    sheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 20 },
        { header: 'Order Date', key: 'orderDate', width: 20 },
        { header: 'Total Amount', key: 'totalAmount', width: 15 },
        { header: 'Discount Amount', key: 'discountAmount', width: 15 },
        { header: 'Product Name', key: 'productName', width: 30 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Price', key: 'price', width: 15 },
    ];

    reportData.orders.forEach(order => {
        order.products.forEach(product => {
            sheet.addRow({
                orderId: order.orderId,
                orderDate: new Date(order.orderDate).toLocaleDateString(),
                totalAmount: order.totalAmount,
                discountAmount: isNaN(order.discountAmount) ? 0 : order.discountAmount,
                productName: product.productName,
                quantity: product.quantity,
                price: product.price
            });
        });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
};

const multer = require('multer');
const path = require('path');
const { error } = require("console");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, path.join(__dirname, '../assets2/img'));
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

const upload = multer({ storage: storage });



///////////////////////////////////////////////////////////////////////

const toAdminDash = async (req, res) => {
    try {
        const admin = req.session.admin;
        const users = await User.find();
        res.render("adminDash",{admin, users});
    }
    catch (err) {
        console.log("Error fetching admin dashboard", err);
        res.status(500).send("Internal server error");
    }
}

const loginHome = (req, res) => {
    if (req.session.admin) {
        res.redirect('/admin/dashboard');
    }
    else {
        res.render('adminLogin');
    }
}

const verifyLogin = async (req, res) => {
    try {
        const {email, password} = req.body;
        const admin = await User.findOne({email})

    if (!admin || (password !== admin.password)) {
        res.status(200).json({ message: "*Invalid email or password!"});
    }
    else {
        req.session.admin = admin;
        res.status(200).json({success: true});
    }
    } catch (err) {
        console.log(err, "Error logging in!");
        res.status(500).send("Internal server error!");
    }
}

const adminLogout = (req, res) => {
    delete req.session.admin;
    res.render("adminLogin", {logoutMsg: "Logout successfully..."});
}

//////////////////////////////////
const ITEMS_PER_PAGE = 5;

const toUserMgmt = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || '';
        const skip = (page - 1) * ITEMS_PER_PAGE;
        
        const query = {
            email: { $ne: "uadmin@gmail.com" },
            $or: [
                { fname: { $regex: search, $options: 'i' } },
                { lname: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ]
        };

        const users = await User.find(query).skip(skip).limit(ITEMS_PER_PAGE);

        const totalUsers = await User.countDocuments(query);

        const totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE);

        res.render('userManagement', {
            users: users,
            pagination: {
                currentPage: page,
                pages: totalPages
            },
            search: search
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        res.status(500).send('Internal Server Error');
    }
};


//////////////////////////////////

const userBlockToggle = async (req, res) => {
    try {
        const {userId, isBlocked} = req.body;
        console.log(userId, isBlocked);
        if (isBlocked === true) {
            await User.updateOne({_id: userId},{$set: {isBlocked: false}});
            res.status(200).json({message: 'User unblocked'})
        } else {
            await User.updateOne({_id: userId},{$set: {isBlocked: true}});
            res.status(200).json({message: 'User blocked'})
        }
    }
    catch (err) {
        console.error('Error on block toggle:', err);
        res.status(500).send('Internal Server Error');
    }
}

const toCategoryMgmt = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || '';
        const skip = (page - 1) * ITEMS_PER_PAGE;

        const query = {
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ]
        };

        const categories = await Category.find(query).skip(skip).limit(ITEMS_PER_PAGE);

        const totalCategories = await User.countDocuments(query);

        const totalPages = Math.ceil(totalCategories / ITEMS_PER_PAGE);

        res.render('categoryManagement', {
            categories: categories,
            pagination: {
                currentPage: page,
                pages: totalPages
            },
            search: search
        });
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).send('Internal Server Error');
    }
}

const toAddCategory = (req, res) => {
    res.render("addCategory");
}

const verifyAddCategory = async (req, res) => {
    try {
        const {name, description} = req.body;
        const regName = new RegExp(name, 'i');
        const isPresentCategory = await Category.findOne({name: {$regex: regName}});
        if (!isPresentCategory) {
            const category = new Category ({
                name: name,
                description: description
            });
            await category.save();
            console.log("Category saved");
            res.status(200).json({success: true});
        }
        else {
            res.status(200).json({message: "Category already exists!"});
        }
    }
    catch (err) {
        console.error("Error adding category", err);
        res.status(500).send('Internal Server Error');
    }
}

const categoryListToggle = async (req, res) => {
    try {
        const {categoryId, isListed} = req.body;
        console.log(categoryId, isListed);
        if (isListed === true) {
            await Category.updateOne({_id: categoryId},{$set: {isListed: false}});
            res.status(200).json({message: 'Category Unlisted'})
        } else {
            await Category.updateOne({_id: categoryId},{$set: {isListed: true}});
            res.status(200).json({message: 'Category Listed'})
        }
    }
    catch (err) {
        console.error("Error on toggle list:", err);
        res.status(500).send('Internal Server Error');
    }
}

const toEditCategory = async (req,res) => {
    try {
        const categoryId = req.params.category_id;
        const category = await Category.findOne({_id: categoryId});
        res.render('editCategory', {category, categoryId});
    }
    catch (err) {
        console.error("Error fetching edit category:", err);
        res.status(500).send('Internal Server Error');
    }
}

const verifyEditCategory = async (req, res) => {
    try {
        const { name, description } = req.body;
        const regName = new RegExp(name, 'i');
        
        const existingCategory = await Category.findOne({ name: { $regex: regName }, _id: { $ne: req.params.category_id }});

        if (existingCategory) {
            return res.status(200).json({ message: "Category name already exists!" });
        }

        await Category.updateOne({ _id: req.params.category_id }, { $set: { name, description } });

        console.log("Category updated");
        res.status(200).json({ success: true });
    }
    catch (err) {
        console.error("Error editing category!", err);
        res.status(500).send('Internal Server Error');
    }
}




const toProductMgmt = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || '';
        const skip = (page - 1) * ITEMS_PER_PAGE;

        const query = {
            $or: [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } }
            ]
        };

        const products = await Product.find(query).skip(skip).limit(ITEMS_PER_PAGE);
        const totalProducts = await Product.countDocuments(query);

        const totalPages = Math.ceil(totalProducts / ITEMS_PER_PAGE);

        res.render('productManagement', {
            products: products,
            pagination: {
                currentPage: page,
                pages: totalPages
            },
            search: search
        });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).send('Internal Server Error');
    }
}

const toBrandList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * ITEMS_PER_PAGE;

        const brands = await Brand.find({}).skip(skip).limit(ITEMS_PER_PAGE);

        const totalBrands = await Brand.countDocuments({});

        const totalPages = Math.ceil(totalBrands / ITEMS_PER_PAGE);

        res.render('brandList', {
            brands: brands,
            pagination: {
                currentPage: page,
                pages: totalPages
            }
        });
    } catch (err) {
        console.error('Error fetching brands:', err);
        res.status(500).send('Internal Server Error');
    }
}

const toAddBrand = (req, res) => {
    res.render('addBrand');
}

const verifyAddBrand = async (req, res) => {
    try {
        const {brandName, brandDesc} = req.body;
        const regName = new RegExp(brandName, 'i');
        console.log(regName);
        const isPresentBrand = await Brand.findOne({name: {$regex: regName}});

        if (!isPresentBrand) {
            const brand = new Brand({
                name: brandName,
                description: brandDesc
            });
            
            await brand.save();
            console.log("Brand saved");
            res.status(200).json({success: true});
        }
        else {
            res.status(200).json({message: "Brand already exists!"});
        }
    }
    catch (err) {
        console.error("Error adding brand", err);
        res.status(500).send("Internal server error");
    }
}

const toEditBrand = async (req,res) => {
    try {
        const brandId = req.params.brand_id;
        const brand = await Brand.findOne({_id: brandId});
        res.render('editBrand', {brand, brandId});
    }
    catch (err) {
        console.error("Error fetching edit brand:", err);
        res.status(500).send('Internal Server Error');
    }
}

const verifyEditBrand = async (req, res) => {
    try {
        const {name, description} = req.body;
        const regName = new RegExp(name, 'i');
        console.log(req.params.brand_id);
        const existingBrand = await Brand.findOne({ name: { $regex: regName }, _id: { $ne: req.params.brand_id }});

        if (existingBrand) {
            return res.status(200).json({ message: "Brand already exists!" });
        }

        await Brand.updateOne({ _id: req.params.brand_id }, { $set: { name, description } });

        console.log("Brand updated");
        res.status(200).json({ success: true });
    }
    catch (err) {
        console.error("Error editing brand!", err);
        res.status(500).send('Internal Server Error');
    }
}

const toAddProduct = async (req, res) => {
    try {
        const categories = await Category.find({});
        const brands = await Brand.find({});
        res.render('addProduct', {categories, brands});
    }
    catch (err) {
        console.error("Error fetching add product:", err);
        res.status(500).send('Internal Server Error');
    }
}

const verifyAddProduct = async (req, res) => {
    try {
        const { productName, model, description, price, type, strapType, color, category, brand, stock } = req.body;
        const regName = new RegExp(productName, 'i');
        const isProductPresent = await Product.findOne({name: {$regex: regName}});
  
        const images = [];

                const width = 300;
                const height = 300;

                
                if (req.files.image1) {
                    const processedImage1 = await processImage(req.files.image1[0], width, height);
                    images.push(processedImage1);
                }
                if (req.files.image2) {
                    const processedImage2 = await processImage(req.files.image2[0], width, height);
                    images.push(processedImage2);
                }
                if (req.files.image3) {
                    const processedImage3 = await processImage(req.files.image3[0], width, height);
                    images.push(processedImage3);
                }

            if (!isProductPresent) {
                const newProduct = new Product({
                    name: productName,
                    model,
                    description,
                    price,
                    type,
                    strapType,
                    color,
                    category,
                    brand,
                    stock,
                    images,
                    addedDate: new Date(),
                    isDeleted: false
                });
        
                await newProduct.save()
                console.log("Product saved");
                res.status(200).json({success: true});
                }
            else {
                res.status(200).json({message: "Product name already exists!"});
            }
    }
    catch (err) {
        console.error("Error adding the product", err);
        res.status(500).send('Internal Server Error');
    }
}

const processImage = async (file, width, height) => {
    try {
        const outputPath = path.join(__dirname, '../assets2/img', `cropped-${file.filename}`);
        await sharp(file.path)
        .toFile(outputPath);
        return `cropped-${file.filename}`;
    }
    catch (err) {
        console.error("Error processing image:", err);
        res.status(500).send('Internal Server Error');
    }
};

const toEditProduct = async (req,res) => {
    try {
        const categories = await Category.find({});
        const brands = await Brand.find({});
        const productId = req.params.product_id;
        const product = await Product.findOne({_id: productId});
        res.render('editProduct', {product, categories, brands, productId});
    }
    catch (err) {
        console.error("Error fetching edit product:", err);
        res.status(500).send('Internal Server Error');
    }
}

const verifyEditProduct = async (req, res) => {
    
    try {
        const { productName, model, description, price, type, strapType, color, category, brand, stock , existingImage1, existingImage2, existingImage3} = req.body;
        const regName = new RegExp(productName, 'i');
        const isProductPresent = await Product.findOne({ name: { $regex: regName }, _id: { $ne: req.params.product_id }});

        const images = [];

            const width = 300;
            const height = 300;

            if (req.files.image1) {
                const processedImage1 = await processImage(req.files.image1[0], width, height);
                images.push(processedImage1);
                console.log("Pushing new image");
            }
            else {
                console.log("Pushing existing image");
                images.push(existingImage1); }

            if (req.files.image2) {
                const processedImage2 = await processImage(req.files.image2[0], width, height);
                images.push(processedImage2);
            }
            else { images.push(existingImage2); }

            if (req.files.image3) {
                const processedImage3 = await processImage(req.files.image3[0], width, height);
                images.push(processedImage3);
            }
            else { images.push(existingImage3); }

        if (!isProductPresent) {
            await Product.updateOne({_id: req.params.product_id}, {
                name: productName,
                model: model,
                description: description,
                price: price,
                type: type,
                strapType: strapType,
                color: color,
                category: category,
                brand: brand,
                stock: stock,
                images: images,
                addedDate: new Date(),
                isDeleted: false
            });

            console.log("Product updated");
            res.status(200).json({success: true});

            //////
        const carts = await Cart.find({ 'products.product': req.params.product_id });

        for (let cart of carts) {
            cart.products.forEach(item => {
                if (item.product.toString() === req.params.product_id && item.quantity > stock) {
                    item.quantity = stock;
                }
                else if (item.product.toString() === req.params.product_id && item.quantity === 0 && stock > 0) {
                    item.quantity = 1;
                }
            });
            await cart.save();
        }
        //////
        }
        else {
            res.status(200).json({message: "Product name already exists!"});
        }

    }catch(err) {
        console.error("Error editing the product", err);
        res.status(500).send('Internal Server Error');
    }
}

const productListToggle = async (req, res) => {
    try {
        const {productId, isListed} = req.body;
        console.log(productId, isListed);
        if (isListed === true) {
            await Product.updateOne({_id: productId},{$set: {isListed: false}});
            res.status(200).json({message: 'Product Unlisted'})
        } else {
            await Product.updateOne({_id: productId},{$set: {isListed: true}});
            res.status(200).json({message: 'Product Listed'})
        }
    }
    catch (err) {
        console.error("Error on product list toggle:", err);
        res.status(500).send('Internal Server Error');
    }
}
const brandListToggle = async (req, res) => {
    try {
        const {brandId, isListed} = req.body;
        console.log(brandId, isListed);
        if (isListed === true) {
            await Brand.updateOne({_id: brandId},{$set: {isListed: false}});
            res.status(200).json({message: 'Brand Unlisted'})
        } else {
            await Brand.updateOne({_id: brandId},{$set: {isListed: true}});
            res.status(200).json({message: 'Brand Listed'})
        }
    }
    catch (err) {
        console.error("Error on brand list toggle:", err);
        res.status(500).send('Internal Server Error');
    }
}

const toOrderManagement = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const search = req.query.search || '';
        const skip = (page - 1) * ITEMS_PER_PAGE;

        const query = {
            $or: [
                { orderId: { $regex: search } },
            ]
        };

        const orders = await Order.find(query).sort({ orderDate: -1 })
        .populate('user')
        // .skip(skip)
        // .limit(ITEMS_PER_PAGE);

        const totalOrders = await User.countDocuments(query) - 1;

        const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);

        res.render('adminOrderManagement', { 
            orders,
            pagination: {
                currentPage: page,
                pages: totalPages
            },
            search: search
         });
    }
    catch (err) {
        console.error('Error fetching order Management', err);
        res.status(500).send('Internal server error'); 
    }
}

const toOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.order_id;

        const order = await Order.findById(orderId)
        .populate('products.product')
        .populate('payment')

        const subtotal = order.products.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const gst = subtotal * 0.18;
        const subtotalBefore = order.products.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        const shipping = subtotal < 500 ? 40 : 0;
        const totalAmount = order.totalAmount;
        const offerDiscount = subtotalBefore - subtotal;
        const couponDiscount = subtotal * order.coupon.discount / 100;
        const totalDiscount = offerDiscount + couponDiscount;

        res.render('adminOrderDetails', { 
            order,
            subtotal,
            gst,
            shipping,
            totalAmount,
            subtotalBefore,
            totalDiscount
         });
    } catch (err) {
        console.error('Error fetching order details', err);
        res.status(500).send('Internal server error');
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, productId } = req.params;
        const { status } = req.body;

        const order = await Order.findById(orderId);

        const product = order.products.find(item => item.product.toString() === productId);

        const statusOrder = ['pending', 'dispatched', 'delivered'];
        const returnRequestStatus = ['accept', 'reject'];

        if (statusOrder.includes(product.status)) {
            if (statusOrder.indexOf(status) > statusOrder.indexOf(product.status)) {
                product.status = status;
                await order.save();
                return res.json({ success: true });
            }
        } else if (product.status === 'return requested' && returnRequestStatus.includes(status)) {
            if (status === 'accept') {
                product.status = 'return accepted'
                product.returnDate = new Date();
            }  else if (status === 'reject') {
                product.status = 'return rejected'
            } else {
                product.status = status;
            }

            await order.save();
            return res.json({ success: true });
        }

        res.json({ success: false });
    } catch (err) {
        console.error('Error updating order status', err);
        res.status(500).json({ success: false });
    }
};

const toOffersAndCoupons = async (req, res) => {
    try {
        const coupons = await Coupon.find({});
        const offers = await Offer.find({}).populate('item');
        const products = await Product.find({})
        .populate('category')
        .populate('brand')

        const categories = await Category.find({ isListed : true });

         if (!coupons && !offers) {
            return res.render('offersAndCoupons');
         }

         if (!coupons) {
            return res.render('offersAndCoupons', { offers, products, categories });
         }

         if (!offers) {
            return res.render('offersAndCoupons', { coupons });
         }

        res.render('offersAndCoupons', { coupons, offers, products, categories });
    } catch (error) {
        console.error('Error fetching offers and coupons', error);
        res.status(500).send('Internal server error');
    }
}

const toCreateCoupon = async (req, res) => {
    try {
        res.render('addCoupon');
    } catch (error) {
        console.error('Error fetching add coupon', error);
        res.status(500).send('Internal server error');
    }
}

const verifyCreateCoupon = async (req, res) => {
    try {
        const { couponCode, description, discount, minPurchase, maxAmount, validity } = req.body;
        const coupon = new Coupon({
            code: couponCode,
            description,
            discount,
            minPurchase,
            maxAmount,
            validity
        });

        await coupon.save();
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error creating coupon', error);
        res.status(500).json({ success: false });
    }
}

const verifyEditCoupon = async (req, res) => {
    try {
        const { couponCode, description, discount, minPurchase, maxAmount, validity } = req.body;
        const couponId = req.params.coupon_id;
        await Coupon.findByIdAndUpdate(couponId, {
            code: couponCode,
            description: description,
            discount: discount,
            minPurchase: minPurchase,
            maxAmount: maxAmount,
            validity: validity
        });

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error editing coupon', error);
        res.status(500).json({ success: false });
    }
}

const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.coupon_id;
        await Coupon.findByIdAndDelete(couponId);
        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error deleting coupon', error);
        res.status(500).json({ success: false });
    }
}

const toCreateOffer = async (req, res) => {
    try {
        const products = await Product.find().select('_id name');
        const categories = await Category.find().select('_id name');
        res.render('createOffer', { products, categories });
    } catch (error) {
        console.error('Error fetching create offer', error);
        res.status(500).send('Internal server error');
    }
}

const verifyCreateOffer = async (req, res) => {
    try {
        const { name, discount, type, item } = req.body;

        const offer = new Offer({
            name,
            discount,
            type,
            item,
        });

        await offer.save();

        if (type === 'products') {
            await Product.updateMany(
                { _id: item },
                { $addToSet: { offers: offer._id } }
            );
        } else if (type === 'categories') {
            await Product.updateMany(
                { category: item },
                { $addToSet: { offers: offer._id } }
            );
        }

        res.status(200).json({ success: true });

    } catch (error) {
        console.error('Error creating offer', error);
        res.status(500).json({ success: false });
    }
}

const toggleOfferStatus = async (req, res) => {
    try {
        const { offer_id } = req.params;
        const { isActive } = req.body;

        console.log('offerId: ', offer_id, 'isActive: ' , isActive);
    
        const offer = await Offer.findById(offer_id);
        if (!offer) {
          return res.status(404).json({ success: false, message: 'offer not found!' });
        }
    
        offer.isActive = isActive;
        await offer.save();
    
        res.status(200).json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error!' });
      }
}

const toSalesReport = async (req, res) => {
    try {
        res.render('adminSalesReport');
    } catch (err) {
        console.error('Error fetching sales report: ', err);
        res.status(500).send('Internal server error');
    }
}

const generateSalesReport = async (req, res) => {
    const { reportType, startDate, endDate } = req.body;

    let filter = {};
    const currentDate = new Date();

    switch (reportType) {
        case 'daily':
            filter.orderDate = {
                $gte: new Date(currentDate.setHours(0, 0, 0, 0)),
                $lte: new Date(currentDate.setHours(23, 59, 59, 999))
            };
            console.log('Daily Filter:', filter.orderDate);
            break;
        case 'weekly':
            const today = new Date();
            const firstDayOfWeek = today.getDate() - today.getDay();
            const lastDayOfWeek = firstDayOfWeek + 6;

            const startOfWeek = new Date(today.setDate(firstDayOfWeek));
            startOfWeek.setHours(0, 0, 0, 0);

            const endOfWeek = new Date(today.setDate(lastDayOfWeek));
            endOfWeek.setHours(23, 59, 59, 999);

            filter.orderDate = { $gte: startOfWeek, $lte: endOfWeek };
            console.log('Weekly Filter:', filter.orderDate);
            break;
        case 'monthly':
            const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999);
    
            filter.orderDate = { $gte: startOfMonth, $lte: endOfMonth };
            console.log('Monthly Filter:', filter.orderDate);
            break;
        case 'custom':
            if (startDate && endDate) {
                filter.orderDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
                console.log('Custom Filter:', filter.orderDate);
            }
            break;
    }

    try {
        const orders = await Order.find(filter).populate('products.product');

        let totalOrders = 0;
        let totalSales = 0;
        let totalDiscounts = 0;

        const report = orders.map(order => {
            const filteredProducts = order.products.filter(item => item.status === 'delivered' || item.status === 'return requested');
            
            if (filteredProducts.length > 0) {
                let discountAmount = order.coupon !== null ? order.totalAmount * order.coupon.discount / 100 : 0;
                if (discountAmount > order.coupon.maxAmount) {
                    discountAmount = order.coupon.maxAmount;
                }
                const orderTotal = filteredProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                
                totalSales += orderTotal;
                totalDiscounts += isNaN(discountAmount) ? 0 : discountAmount;
                totalOrders++;

                return {
                    orderId: order.orderId,
                    orderDate: order.orderDate,
                    totalAmount: orderTotal,
                    discountAmount: isNaN(discountAmount) ? 0 : discountAmount,
                    products: filteredProducts.map(item => ({
                        productName: item.product.name,
                        quantity: item.quantity,
                        price: item.price,
                        status: item.status
                    }))
                };
            }
        }).filter(order => order); // Filter out undefined values

        res.json({
            totalOrders,
            totalSales: totalSales - totalDiscounts,
            totalDiscounts,
            orders: report
        });
    } catch (error) {
        console.error('Error generating sales report:', error);
        res.status(500).send('Internal server error');
    }
}

const downloadSalesReport =  async (req, res) => {
    const { format, reportType, startDate, endDate } = req.query;

    const reportData = await generateReportData(reportType, startDate, endDate);

    if (format === 'pdf') {
        const pdfBuffer = await generatePDF(reportData);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
        res.send(pdfBuffer);
    } else if (format === 'excel') {
        const excelBuffer = await generateExcel(reportData);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');
        res.send(excelBuffer);
    } else {
        res.status(400).send('Invalid format');
    }
}

const generateReportData = async (reportType, startDate, endDate) => {
    let filter = {};
    const currentDate = new Date();

    switch (reportType) {
        case 'daily':
            filter.orderDate = { $gte: new Date(currentDate.setHours(0, 0, 0, 0)), $lte: new Date(currentDate.setHours(23, 59, 59, 999)) };
            break;
        case 'weekly':
            const weekStartDate = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay()));
            const weekEndDate = new Date(weekStartDate);
            weekEndDate.setDate(weekStartDate.getDate() + 6);
            weekEndDate.setHours(23, 59, 59, 999);
            filter.orderDate = { $gte: weekStartDate, $lte: weekEndDate };
            break;
        case 'monthly':
            const monthStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
            const monthEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
            monthEndDate.setHours(23, 59, 59, 999);
            filter.orderDate = { $gte: monthStartDate, $lte: monthEndDate };
            break;
        case 'custom':
            if (startDate && endDate) {
                filter.orderDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
            }
            break;
    }

    const orders = await Order.find(filter).populate('products.product');
    
    const report = orders.map(order => {
        const discountAmount = order.coupon ? (order.totalAmount * order.coupon.discount / 100) : 0;
        return {
            orderId: order.orderId,
            orderDate: order.orderDate,
            totalAmount: order.totalAmount,
            discountAmount: isNaN(discountAmount) ? 0 : discountAmount,
            products: order.products.map(item => ({
                productName: item.product.name,
                quantity: item.quantity,
                price: item.price
            }))
        };
    });

    const totalDiscounts = report.reduce((acc, order) => acc + order.discountAmount, 0);

    return {
        totalOrders: orders.length,
        totalSales: orders.reduce((acc, order) => acc + order.totalAmount, 0),
        totalDiscounts: totalDiscounts,
        orders: report
    };
};

const verifyEditOffer = async (req, res) => {
    try {
        const { offerName, discount, type, items } = req.body;
        const offerId = req.params.offer_id;
        await Offer.findByIdAndUpdate(offerId, {
            name: offerName,
            discount: discount,
            type: type,
            items: items
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error editing offer', error);
        res.status(500).json({ success: false });
    }
}


module.exports = {
    toAdminDash,
    loginHome,
    verifyLogin,
    adminLogout,
    toUserMgmt,
    userBlockToggle,
    toCategoryMgmt,
    toAddCategory,
    verifyAddCategory,
    toEditCategory,
    verifyEditCategory,
    categoryListToggle,
    toProductMgmt,
    toBrandList,
    toAddBrand,
    verifyAddBrand,
    toEditBrand,
    verifyEditBrand,
    toAddProduct,
    verifyAddProduct,
    upload,
    toEditProduct,
    verifyEditProduct,
    productListToggle,
    brandListToggle,
    toOrderManagement,
    toOrderDetails,
    updateOrderStatus,
    toOffersAndCoupons,
    toCreateCoupon,
    verifyCreateCoupon,
    verifyEditCoupon,
    deleteCoupon,
    toCreateOffer,
    verifyCreateOffer,
    toggleOfferStatus,
    toSalesReport,
    downloadSalesReport,
    generateSalesReport,
    verifyEditOffer

}