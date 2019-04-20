module.exports = {
    MS: {
        product: {
           url: "http://localhost:4000",
           prefix: "products"
        },
        cart: {
           url: "http://localhost:5000",
           prefix: "shopping-carts"
        }
     },
     acl: {
        roles: {
           CUSTOMER: {
               resources: [
                  "/:cartId",
                  "/:cartId/items/:itemId",
                  "/:cartId/items/:itemId"
               ],
               permissions: ["get", "post", "delete"]
           }, 
           ADMIN: {
               resources: [
                  "/"
               ],
               permissions: ["get"]
           }
        }
     }
}