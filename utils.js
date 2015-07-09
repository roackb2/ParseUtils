/*
 * Usage: require this file, ex.
 *   var util = require("util.js");
 *   var publicAttrs = ['nickname', 'mood', 'inviteCode'];
 *   util.filterUserData(publicAttrs, data); 
 *   // please left the path parameter blank, its for circular detection.
 * Data could be anything that might contain user data, 
 * say ParseObject that has ParseUser attributes, or array of ParseObjects.
 * Attributes that are not in the publicAttrs would be filtered out.
 * 
 * NOTICE: The objectId, createdAt and updatedAt would be still remained accessible
 *         and will not be filtered out.
 * CAUTION: You must call this function immediately before response and 
 *          DO NOT call any save() of any object that you filtered, 
 *          to prevent corruption of your database. 
 */
exports.filterUserData = function(publicAttrs, obj, path) {
    // var publicAttrs = ["nickname", "avatar", "mood", "inviteCode"];
    var isArray = Array.isArray(obj);
    var isObject = typeof(obj) == "object";
    var isUser = obj.className != undefined && obj.className == "_User";
    if(isArray || isObject) {
        if(path == null) {
            path = [];
        }
        path.push(obj);
        var encountered = false;
        for(var i = 0; i < path.length - 1; i++) {
            if(path[i] === obj) {
                encountered = true;
            }
        }    
        if(isArray && !encountered) {            
            for(var i = 0; i < obj.length; i++) {
                exports.filterUserData(publicAttrs, obj[i], [].concat(path));
            }
        } else if(isObject && !encountered) {
            if(isUser) {
                for(var key in obj._serverData) {
                    if(publicAttrs.indexOf(key) == -1) {
                        delete obj._serverData[key];
                    }
                }
                for(var key in obj.attributes) {
                    if(publicAttrs.indexOf(key) == -1) {
                        delete obj.attributes[key];
                    }
                }
            } else {
                for(var key in obj) {
                    exports.filterUserData(publicAttrs, obj[key], [].concat(path));
                }
            }
        }        
    }
}
