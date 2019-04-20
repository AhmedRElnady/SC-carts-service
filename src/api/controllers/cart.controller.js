const express = require('express');
const router = express.Router();
const Cart = require('../../models/cart.model');
const validate = require('../middlewares/validators');
const authorize = require('../middlewares/authorize.middleware');

const config = require('config');

const apiAdapter = require('../../config/api-adapter/api-adapter'),
    productMSURL = config.get('MS.product.url'),
    productMSPrefix = config.get('MS.product.prefix');



// get all shoppingCarts [admin]
router.get('/', authorize(), async (req, res, next) => {
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

// get a specific cart, each user can only show his shoppingCart [customer]
router.get('/:cartId', authorize(), async (req, res, next) => {
    try {
        const cartId = req.params.cartId;

        const cart = await Cart.findById(cartId);
        if (!cart) return res.status(404).json({ msg: `The shopping cart with this id ${cartId} is not found ! ` })

        res.status(200).json({
            data: cart
        })
    } catch (e) {
        
    }
})


// to push a new item to the cart [customer]
// in real app: decrement or increment should be after checkout action.
router.post('/:cartId/items/:itemId', authorize(), async (req, res, next) => {
    try {
        const cartId = req.params.cartId,
            prodId = req.params.itemId,
            prodQuantity = req.body.prodQuantity;

        // 1. should check the product availability in proudct service 
        const productAdapter = apiAdapter(productMSURL);
        const { data } = await productAdapter.get(`/${productMSPrefix}/${prodId}/isAvailable/${prodQuantity}`);

        if (data === -1) return res.status(200).json({ msg: "This product is not exist" })
        if (data === 0) return res.status(200).json({ msg: "The ordered quantity exceed the inventory" })
        // Todo: refactor.
        const alreadyPushed = await Cart.findOne({ _id: cartId, "products.prodId": prodId }, { "products.$": 1 })
        if (alreadyPushed) return res.status(200).json({ msg: 'This item is already exist in your cart !' })

        // 2. If every thing is ok,push the item 
        const prodPrice = data.prodPrice;
        const itemPrice = +prodPrice * +prodQuantity;

        await Cart.updateOne({ _id: cartId }, {
            $push: {
                products: {
                    prodId,
                    prodPrice,
                    prodQuantity
                }
            },
            // 3. Update cartPrice
            $inc: {
                cartPrice: itemPrice
            }
        }, { new: true });

        // 4. decrement inventory amount in product service. 
        await productAdapter.delete(`/${productMSPrefix}/${prodId}/inventory/${prodQuantity}`);

        return res.status(200).json({ msg: 'A new product is added to your cart.' });
    } catch (e) {

    }
})

// to pop an item from the cart [customer]
router.delete('/:cartId/items/:itemId', async (req, res, next) => {
    try {
        const cartId = req.params.cartId,
            prodId = req.params.itemId,
            productAdapter = apiAdapter(productMSURL);

        // 1. find this item (return its price and quantity)
        const itemToDelete = await Cart.findOne({ _id: cartId, "products.prodId": prodId }, { "products.$": 1 })
        if (!itemToDelete) return res.status(200).json({ msg: `The item with id ${prodId} is not exist in the cart !` });

        let totalProdPrice,
            { prodPrice, prodQuantity } = itemToDelete.products[0];

        // 2. calculate the total price of this item (price * quantity)
        totalProdPrice = prodPrice * prodQuantity;

        const updatedCart = await Cart.findByIdAndUpdate(cartId, {
            // 3. pull item 
            $pull: { products: { prodId: prodId } },
            // 4. update cartPrice (decrement)
            $inc: { cartPrice: -totalProdPrice }
        }, { new: true })

        // 5. Increment inventory amount in product service. 
        await productAdapter.post(`/${productMSPrefix}/${prodId}/inventory/${prodQuantity}`);

        return res.status(200).json({ msg: "item is deleted form shopping cart and cart price is updated successfully" });
    } catch (e) {
    }
})


///////////////////////////////////////////////////////////////////////////////////////////
//////////////// private routes (can NOT accessed directly from api gateway, 
////////////////           other services can call them internally) 
///////////////////////////////////////////////////////////////////////////////////////////

// add a new shoppingCart if the use doesn't have one.
// will be created after user login.
router.post('/', async (req, res, next) => {
    try {
        const userId = req.body.userId;

        const userPendingCart = await Cart.findOne({ userId, cartStatus: 'PENDING' });

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
    }
})

/*
    in the following cases: 
        1. A product's price is updated
        2. A product is deleted.

*/
router.patch('/items/:itemId', async (req, res, next) => {
    try {
        const itemId = req.params.itemId,
            newPrice = req.body.newPrice,
            updatePromises = [];

        // 1. find the item in all pending shopping carts 
        const pendingCartsToUpdate = await Cart.find({ cartStatus: "PENDING", "products.prodId": itemId }, { "products.$": 1 });

        if (pendingCartsToUpdate && pendingCartsToUpdate.length > 0) {
            for (let cart of pendingCartsToUpdate) {

                const cartId = cart._id,
                    oldPrice = cart.products[0].prodPrice,
                    prodQuantity = cart.products[0].prodQuantity;

                // 2. calculate the total change amount in shopping cart price.
                const cartChangeAmount = (newPrice - oldPrice) * prodQuantity;

                updatePromises.push(Cart.update({ _id: cartId, "products.prodId": itemId }, {
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
        }
        return res.status(200).json({ msg: 'All Pending carts are updated! ' })

    } catch (e) {
    }
})
// todo : make it one single function with update product price.
router.delete('/items/:itemId', async (req, res, next) => {
    try {
        const itemId = req.params.itemId,
            promises = [];

        // 1. find pending carts that contain this item.
        const cartsToRemoveItem = await Cart.find({ "products.prodId": itemId }, { "products.$": 1 });

        for (cart of cartsToRemoveItem) {
            const cartId = cart._id,
                prodPrice = cart.products[0].prodPrice,
                prodQuantity = cart.products[0].prodQuantity;

            // 2. calculate the total change amount in shopping cart price.
            const cartChangeAmount = prodPrice * prodQuantity;

            promises.push(Cart.update({ _id: cartId }, {
                $pull: {
                    products: { "products.prodId": itemId }
                },
                $inc: {
                    cartPrice: -cartChangeAmount
                }
            }))
        }

        await Promise.all(promises);

        return res.status(200).json({ msg: `Item with Id ${itemId} is deleted form all pending carts` })
    } catch (e) {
    }
})

module.exports = router;