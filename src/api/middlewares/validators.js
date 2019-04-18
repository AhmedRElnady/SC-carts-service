// implement it
function validate() {
    return (req, res, next) => {
        (async() => {
            console.log(".... valid ....");
            next();
        })()
    }
}

module.exports = validate;