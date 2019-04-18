const express = require('express');
const router = express.Router();
const Cart = require('../../models/cart.model');
// const validate = require('../middlewares/validators');

const config = require('config');


// add a new shoppingCart if the use doesn't have one.
// will be created after user login.
router.post('/', async (req, res, next) => {
    try {
        const userId = req.body.userId;
    
        const userPendingCart = await Cart.findOne({ userId, cartStatus: 'PENDING' });
        console.log(">>>> userPendingCart >>>", userPendingCart);
        if (!userPendingCart) {
            const createdCart = await Cart.create({
                userId,
                products: []
            });
            return res.status(201).json({
                msg: 'A new shopping cart is created.',
                data: createdCart._id
            })
        }
        return res.status(200).json({
            msg: 'The user already have a pending cart',
            data: userPendingCart._id
        })
    } catch (e) {
        console.log("... err ...", e)
    }
})


// get all shoppingCarts [admin]
router.get('/', async (req, res, next) => {
    try {
        // todo: pagination
        const carts = await Cart.find({});

        res.status(200).json({
            msg: ">>> In The Name Of ALLAH",
            data: carts
        })
    } catch (e) {

    }
});

// get a spisific cart each user can only show his shoppingCart [user]
router.get('/:cartId', async (req, res, next) => {
    try {
        const productId = req.params.id;

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ msg: `The product with this id ${productId} is not found ! ` })

        res.status(200).json({
            data: product
        })
    } catch (e) {

    }
})


// to push a new item to the cart
// in real app: decrement or increment should be after checkout action.
router.post('/:cartId/items', async (req, res, next) => {
    try {
        // 1. should check the availability in proudct service 
        // 2. push item 
        const cartId = req.params.cartId,
            prodId = req.body.prodId,
            prodPrice = req.body.prodPrice,
            prodQuantity = req.body.prodQuantity;

        const itemPrice = +prodPrice * +prodQuantity;
        console.log('>>>>> itemPrice >>>', itemPrice);

        const updatedCart = await Cart.findByIdAndUpdate(cartId, {
            $push: {
                products: {
                    prodId,
                    prodPrice,
                    prodQuantity
                }
            },
            $inc: {
                cartPrice: itemPrice
            }
        }, { new: true });

        // then update cartPrice


        console.log(">>>>>> updatedCart >>>>>", updatedCart);
        Promise.all()
        return res.status(200).json({
            msg: 'updated !'
        });

        // 3. decrement inventory amount in product service. 

    } catch (e) {

    }

})

// to pop an item from the cart
router.delete('/:cartId/items/:itemId', async (req, res, next) => {
    try {
        const cartId = req.params.cartId,
            itemId = req.params.itemId;


        // 1. find this item (return its price and quantity)
        const itemToDelete = await Cart.find({ _id: cartId, "products._id": itemId }, { "products.$": 1 })
        let totalProdPrice,
            { prodPrice, prodQuantity } = itemToDelete[0].products[0];

        console.log(">>>> itemToDelete >>>>", itemToDelete[0].products[0]);
        console.log(">>>> prodPrice >>>>", prodPrice, prodQuantity);
        // 2. calculate the total price of this item (price * quantity)
        totalProdPrice = prodPrice * prodQuantity;

        const updatedCart = await Cart.findByIdAndUpdate(cartId, {
            // 3. pull item 
            $pull: { products: { _id: itemId } },
            // 4. update cartPrice (decrement)
            $inc: { cartPrice: -totalProdPrice }
        }, { new: true })

        // 5. Increment inventory amount in product service. 

        console.log(">>>> updatedCart >>>>", updatedCart);

        return res.status(200).json({ msg: "item is deleted form shopping cart and cart price is updated successfully" });

    } catch (e) {

    }
})


///////////////////////////////////////////////////////////
////////// private routes /////////////////////////////////
///////////////////////////////////////////////////////////

/*
    in the following cases: 
        1. A product's price is updated
        2. A product is deleted.

*/
router.patch('/items/:itemId', async (req, res, next) => {
    try {
        // A product's price is updated

        const itemId = req.params.itemId,
            newPrice = 5, //req.body.newPrice,
            updatePromises = [];

        // find the item in all pending shopping carts 
        const pendingCartsToUpdate = await Cart.find({ cartStatus: "PENDING", "products._id": itemId }, { "products.$": 1 });

        console.log(">>>>> cartsToUpdate >>>>", pendingCartsToUpdate);


        for (let cart of pendingCartsToUpdate) {


            const cartId = cart._id,
                oldPrice = cart.products[0].prodPrice,
                prodQuantity = cart.products[0].prodQuantity;

            // 2. calculate the total change amount in shopping cart price.
            const cartChangeAmount = (newPrice - oldPrice) * prodQuantity;
            console.log(">>>>> cartChangeAmount >>>>", newPrice, oldPrice, cartChangeAmount);
            updatePromises.push(Cart.update({ _id: cartId, "products._id": itemId }, {
                // 3. update the product with new price
                $set: {
                    "products.$.prodPrice": newPrice
                },
                // 4. update the total cart price
                $inc: {
                    cartPrice: cartChangeAmount
                }
            }))


        }

        await Promise.all(updatePromises);

        return res.status(200).json({ msg: 'All Pending carts are updated! ' })



    } catch (e) {
        console.log(">>> e .>>>", e);

    }
})

router.delete('/items/:itemId', async (req, res, next) => {
    try {
        // todo : make it one single function with update product price.
        const itemId = req.params.itemId,
            promises = [];

        // 1. find pending carts that contain this item.
        const cartsToRemoveItem = await Cart.find({ "products._id": itemId }, { "products.$": 1 });

        for (cart of cartsToRemoveItem) {
            const cartId = cart._id,
                prodPrice = cart.products[0].prodPrice,
                prodQuantity = cart.products[0].prodQuantity;

            // 2. calculate the total change amount in shopping cart price.
            const cartChangeAmount = prodPrice * prodQuantity;

            promises.push(Cart.update({ _id: cartId }, {
                $pull: {
                    products: { "products._id": itemId }
                },
                $inc: {
                    cartPrice: cartChangeAmount
                }
            }))
        }

        await Promise.all(promises);

        return res.status(200).json({
            msg: `Item with Id ${itemId} is deleted form all pending carts`
        })
    } catch (e) {

    }

})



module.exports = router;