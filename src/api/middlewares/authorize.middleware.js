const config = require('config');

function authorize() {
    return (req, res, next) => {
        (async () => {
        
            const tokenPayload = JSON.parse(req.headers['x-payload-header']),
                userId = tokenPayload.id,
                userRole = tokenPayload.role,
                reqResource = req.route.path,
                reqMethod = req.method.toLowerCase(),
                roles = config.get('acl.roles');

            for (let role in roles) {
                if (role === userRole) {
                    const roleObj = roles[role],
                        allowedResources = roleObj.resources,
                        allowedPermissions = roleObj.permissions;

                    if (userRole === 'CUSTOMER') { // each customer can only access his own cart
                        const cartId = tokenPayload.cartId,
                            requestedCartId = req.params && req.params.cartId;

                        if (!cartId || (requestedCartId !== cartId))
                            return res.json({ msg: "Insufficient permissions to access resource" })
                    }

                    if (allowedResources.includes(reqResource) && allowedPermissions.includes(reqMethod)) {
                        next();
                    } else {
                        res.json({ msg: "Insufficient permissions to access resource" }) // 403
                    }

                    break;
                }
            }
            
        })();
    }
}

module.exports = authorize;