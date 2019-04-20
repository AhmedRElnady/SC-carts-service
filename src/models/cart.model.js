const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
    userId: { // Todo :should be seperated in a new service called customer.
        type: mongoose.Schema.Types.ObjectId,  // to populate accross databases
    },
    products: [{
        prodId: {
            type: mongoose.Schema.Types.ObjectId,
        },
        prodPrice: Number,
        prodQuantity: Number
    }],
    cartPrice: {
        type: Number,
        default: 0,
    },
    cartStatus: {
        type: String,
        enum: ['PENDING', 'CANCELED', 'PAID'],
        default: 'PENDING',
    }
}, { timestamps: true });

cartSchema.set('toJSON', {
    transform: function (doc, ret, opt) {
        ret.id = ret._id;

        delete ret.deleted;
        delete ret._id;
        delete ret.__v;
    }
})

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;

