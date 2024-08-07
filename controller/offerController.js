const Category = require("../models/categoriesModel");
const Product = require("../models/productSchema");
const Offer = require("../models/offerModel");







const loadOffers = async (req, res) => {
    try {
      const productOffers =await Offer.find({type:"product"}).populate('products.productId')
      const categoryOffers =await Offer.find({type:"category"}).populate('category.category').exec();
      const products = await Product.find(); 
      const categories = await Category.find(); 
      res.render('offers', {  productOffers,categoryOffers, products,categories });
    } catch (error) {
      console.error('Error loading offers:', error);
      res.status(500).send('Internal Server Error');
    }
  };
  

  const addOffer = async (req, res) => {
    try {
      const { title, description, discount, type, category, status, 'applied-products': appliedProducts } = req.body;
     
  
      const booleanStatus = status === 'true';
      const products = appliedProducts.map(productId => ({ productId }));
  
      const newOffer = new Offer({
        offerName: title,
        description,
        discount,
        type:"product",
        products,
        category,
        status: booleanStatus 
      });
  
        await newOffer.save();


    if (appliedProducts && appliedProducts.length > 0) {
      await Product.updateMany(
        { _id: { $in: appliedProducts } },
        { $addToSet: { offers: newOffer._id } }
      );
    }
  
      res.status(201).json({ message: 'Offer added successfully' });
    } catch (error) {
      console.error('Error adding offer:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  
  const editOffer = async (req, res) => {
    try {
      const { offerId, offerName, description, discount, type, category, status, products } = req.body;
      console.log(req.body);
     // Fetch the old offer first
     const oldOffer = await Offer.findById(offerId);
     if (!oldOffer) {
       return res.status(404).json({ success: false, message: 'Offer not found' });
     }
      const booleanStatus = status === true; 

      const updatedProducts = products.map(productId => ({ productId }));
  
      const updatedOffer = {
        offerName,
        description,
        discount,
        type,
        products: updatedProducts,
        category,
        status: booleanStatus
      };
  
      const result = await Offer.findByIdAndUpdate(offerId, updatedOffer, { new: true });
  
      if (!result) {
        return res.status(404).json({ success: false, message: 'Offer not found' });
      }
   // Remove the offer from products that are no longer associated
    const removedProducts = oldOffer.products.filter(p => !products.includes(p.productId.toString()));
    if (removedProducts.length > 0) {
      await Product.updateMany(
        { _id: { $in: removedProducts.map(p => p.productId) } },
        { $pull: { offers: offerId } }
      );
    }

    // Add the offer to new products
    const newProducts = products.filter(p => !oldOffer.products.some(op => op.productId.toString() === p));
    if (newProducts.length > 0) {
      await Product.updateMany(
        { _id: { $in: newProducts } },
        { $addToSet: { offers: offerId } }
      );
    }
      res.status(200).json({ success: true, message: 'Offer updated successfully', offer: result });
    } catch (error) {
      console.error('Error updating offer:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };
  




  
  const addCategoryOffer = async (req, res) => {
    try {
      const { title, description, discount, type, status, 'applied-categories': appliedCategories } = req.body;
      

    // Convert the status to a boolean
    const booleanStatus = status.toLowerCase() === 'active';

    const category = appliedCategories.map(category => ({ category }));

      const newOffer = new Offer({
        offerName: title,
        description,
        discount,
        type:"category",
        category,
        status: booleanStatus 
      });
  
      await newOffer.save();

      if (appliedCategories && appliedCategories.length > 0) {
        await Product.updateMany(
          { _id: { $in: appliedCategories } },
          { $addToSet: { offers: newOffer._id } }
        );
      }

      res.status(201).json({ message: 'Offer added successfully' });
    } catch (error) {
      console.error('Error adding offer:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };



  
  const editCategoryOffer = async (req, res) => {
    try {
      const { offerId, offerName, description, discount, type, categories, status,  } = req.body;
   
      const booleanStatus = status === true; // Changed this line

      const updatedCategories = categories.map(category => ({ category }));
  
      const updatedOffer = {
        offerName,
        description,
        discount,
        type,
        category: updatedCategories,
        
        status: booleanStatus
      };
  
      const result = await Offer.findByIdAndUpdate(offerId, updatedOffer, { new: true });
  
      if (!result) {
        return res.status(404).json({ success: false, message: 'Offer not found' });
      }
  
      res.status(200).json({ success: true, message: 'Offer updated successfully', offer: result });
    } catch (error) {
      console.error('Error updating offer:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };
  

  const deleteOffer = async (req, res) => {
    try {
      const { offerId } = req.params;
      
      const offer = await Offer.findById(offerId);
      if (!offer) {
        return res.status(404).json({ message: 'Offer not found' });
      }
  
      // Remove the offer reference from all associated products
      if (offer.type === 'product') {
        await Product.updateMany(
          { _id: { $in: offer.products.map(p => p.productId) } },
          { $pull: { offers: offerId } }
        );
      } else if (offer.type === 'category') {
        await Product.updateMany(
          { category: { $in: offer.category.map(c => c.category) } },
          { $pull: { offers: offerId } }
        );
      }
  
      await Offer.findByIdAndDelete(offerId);
      
      res.status(200).json({ message: 'Offer deleted successfully' });
    } catch (error) {
      console.error('Error deleting offer:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  
  
module.exports = {
    loadOffers,
     addOffer,
     editOffer,
     addCategoryOffer,
     editCategoryOffer,
     deleteOffer


}