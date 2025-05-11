const User = require('../models/userModel');
const  bcrypt = require('bcrypt');
const Category = require('../models/categoriesModel');



const loadCategory = async (req, res) => {
    try {
      let page = 1;
      if (req.query.page) {
        page = +req.query.page;
      }
  
      const search = req.query.search || '';
      const query = search ? { name: { $regex: '.*' + search + '.*', $options: 'i' } } : {};
      const limit = 8;
      
      const count = await Category.countDocuments(query);
      
      const categories = await Category.find(query)
        .sort({ date: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();
  
      const totalPages = Math.ceil(count / limit);
      let previous = page > 1 ? page - 1 : 1;
      let next = page < totalPages ? page + 1 : totalPages;
      
      res.render('categories', {
        categories: categories,
        totalPages: totalPages,
        currentPage: page,
        previous: previous,
        next: next,
        search
      });
    } catch (err) {
      console.log(err.message);
    }
  };
  


const loadaAddCategory = async(req,res)=>{
    try{
        res.render('categoryadd')
    }catch(err){
        console.log(err.message)
    }
}



const insertCategory = async(req,res)=>{
    try{
                const { description,name,gender } = req.body;
                const lowerCaseName = name.toLowerCase();

                const existingCategory = await Category.findOne({ name: new RegExp(`^${lowerCaseName}$`, 'i') }); 
                if(existingCategory){
                        req.flash('error','already exists a category with this name')
                        res.redirect('/admin/createCategory')
                }else{
                    const category = new Category({
                        name:name,
                        description:description,
                        gender:gender,
                        is_listed:1
        
                    })
                await category.save();
                res.redirect('/admin/categories')
    }
                }
         

    catch(err){
        console.log(err.message)
    }
}


const listUnlistCategory = async(req,res)=>{
    try{
       const {category} = req.body;
       const CategoryData = await Category.findById(category);
       await Category.findByIdAndUpdate(category,{
        $set:{
           is_listed: !CategoryData.is_listed
        }
       
    })
    //    passing success obj ////
       res.json({list:true});
      
    }catch(err){
        console.log(err.message)
    }
}

const editCategorypageLoad = async(req,res)=>{
    try{
            const id=req.query.id;
            const category=await Category.findById({_id:id});
            
            if(category){
                res.render('editCategory',{categoryedit :category});
            }
            else{
             res.redirect('/admin/categories')
            }
        

    }catch(err){
        console.log(err.message)
    }
}

const editCategory = async (req, res) => {
    try {
        
    const { _id,name,description } = req.body.id;
    
      const newName = req.body.editname;
      const newDescription = req.body.editdisc;
      const newGender=    req.body.editgender


      const existingCategory = await Category.findOne({ name: req.body.editname });
      if(existingCategory){
        req.flash('error','error! alredy exixst a category with this name')
        res.redirect('/admin/categories');
      }else{
        
        await Category.findByIdAndUpdate({_id:req.body.id},{$set:{name:newName  ,description:newDescription, gender:newGender}})
        res.redirect('/admin/categories');
      }
   
        
     
    } catch (error) {
      console.log(error.message);
      res.status(500).send('Internal Server Error');
    }
  };



  module.exports = {
    loadCategory,
    loadaAddCategory,
    insertCategory,
    editCategory,
    listUnlistCategory,
    editCategorypageLoad,
    
  }