'use strict';

// polyfill for array every
exports.every = function(arr, satisfy) {
    var value = true;
    for (var i = 0; i < arr.length; i++) {
        if (!satisfy(arr[i])) {
            value = false;
        }
    }
    return value;
}

// polyfill for array somer
exports.some = function(arr, satisfy) {
    var value = false;
    for (var i = 0; i < arr.length; i++) {
        if (satisfy(arr[i])) {
            value = true;
        }
    }
    return value;
}

//  shuffle array
exports.shuffle = function(array) {
    var currentIndex = array.length;
    var temporaryValue;
    var randomIndex;

    while (0 != currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

// generate uuid-like string
exports.uuid = function() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    var uuid = s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4()
    return uuid;
}


// rolling dice to decide true or false, given possibility
exports.rollDice = function(possibility) {
    var random = Math.floor(Math.random() * 1000);
    var limit = possibility * 1000;
    return random < limit;
}


/*
 *  Asynchronous for loop.
 *  
 */
exports.WaterFall = function() {
    this.functions = [];
    this.params = [];
    this.counter = 0;
    this.results = [];
    var owner = this;

    this.push = function(toDo, param) {
        owner.params.push(param);
        owner.functions.push(function() {
            return toDo.apply(toDo, param).then(function(result) {
                owner.results.push(result);
                owner.counter++;
                if (owner.counter == owner.functions.length) {
                    return owner.results;
                } else {
                    return owner.functions[owner.counter](owner.params[owner.counter]);
                }
            }, function(error) {
                return Parse.Promise.error(error);
            });
        });
    }

    this.start = function() {
        if (owner.functions.length == 0) {
            return Parse.Promise.error("no function to do");
        } else {
            return owner.functions[0]();
        }
    }

}


/*
 * logic: 
 *
 * var params = [...];
 * var result = task.apply(this, params);
 * while(satisfy(result))  {
 *    result = task.apply(this, params);
 *    postTask(params);
 * }
 */
exports.AsyncWhile = function(task, satisfy, postTask, autoRetry) {
    this.task = task;
    this.postTask = postTask;
    this.results = [];
    this.satisfy = satisfy;
    var owner = this;

    this.start = function(params) {

        owner.params = params;

        return owner.task.apply(this, params).then(function(result) {
            owner.results.push(result);
            if (owner.postTask != undefined) {
                owner.postTask.apply(this, params);
            }
            if (owner.satisfy(result)) {
                return owner.start(params);
            } else {
                return Parse.Promise.as(owner.results);
            }
        }, function(err) {
            if(autoRetry) {
                console.log("error: ")
                console.log(err);
                console.log("auto retry");
                return owner.start(params);
            } else {
                return Parse.Promise.error(err);                
            }
        })
    }
}


/*
 *  unlimited query, can query for larger than 10,000
 *  documents. 
 *  limitation: no sort, skip, limit supported
 */
exports.query = function(clss, callback) {
    var quantum = 1000;
    var pipeSize = 10;
    var list = new Array();
    var finalPromise = new Parse.Promise();

    var countQuery = new Parse.Query(clss);
    if (typeof(callback) != "undefined") {
        var newQuery = callback(countQuery);
        if (newQuery === undefined) {
            callback(countQuery);
        } else {
            countQuery = newQuery;
        }
    }
    countQuery.count().then(function(count) {

        console.log("count: " + count);

        var pages = Math.ceil(count / quantum);
        var pipes = Math.ceil(pages / pipeSize);
        var pipeChain = new Array();

        var counter = 0;

        for (var i = 0; i < pipes; i++) {
            pipeChain[i] = function(start) {
                console.log("query on " + clss + ", No." + counter + " pipe starts");
                var pagePromises = new Array();
                var limit;
                if (counter == pipes - 1 && pages != pipeSize) {
                    limit = pages % pipeSize;
                } else {
                    limit = pipeSize;
                }
                for (var j = 0; j < limit; j++) {
                    var smallQuery = new Parse.Query(clss);
                    if (typeof(callback) != "undefined") {
                        var newQuery = callback(smallQuery);
                        if (newQuery === undefined) {
                            callback(smallQuery);
                        } else {
                            smallQuery = newQuery;
                        }
                    }

                    var date;
                    if (smallQuery._where && smallQuery._where.createdAt && smallQuery._where.createdAt.$lt) {
                        date = new Date(smallQuery._where.createdAt.$lt.iso);
                    }
                    if (date && date < start) {
                        smallQuery.lessThan("createdAt", date);
                    } else {
                        smallQuery.lessThan("createdAt", start);
                    }
                    smallQuery.descending("createdAt");
                    smallQuery.limit(quantum);
                    smallQuery.skip(j * quantum);
                    pagePromises.push(smallQuery.find());
                }
                Parse.Promise.when(pagePromises).then(function() {
                    for (var k = 0; k < arguments.length; k++) {
                        //console.log("arguments " + k + " length: " + arguments[k].length);
                        list = list.concat(arguments[k]);
                    }
                    console.log("query on " + clss + ", No." + counter + " pipe ends, total list length: " + list.length);
                    counter++;
                    if (counter == pipes) {
                        finalPromise.resolve(list);
                    } else {
                        //console.log("createdAt of last list item: " + list[list.length - 1].createdAt);
                        pipeChain[counter](list[list.length - 1].createdAt);
                    }
                }, function(error) {
                    finalPromise.reject(error);
                });
            }
        }
        if (pipes == 0) {
            console.log("query on " + clss + ", return empty array");
            finalPromise.resolve(new Array());
        } else {
            pipeChain[counter](new Date());
        }
    }, function(error) {
        finalPromise.reject(error)
    });

    return finalPromise;

}

exports.encodeUTF8 = function(s) {
    return unescape(encodeURIComponent(s));
}

exports.decodeUTF8 = function(s) {
    return decodeURIComponent(escape(s));
}

// stringify objects and print on console
exports.print = function(obj, ignoreFunc, printFuncContent) {
    console.log(stringify(obj, ignoreFunc, printFuncContent));
}

function stringify(obj, ignoreFunc, printFuncContent, former, depth, path) {
    var indent = "    ";
    if (ignoreFunc == undefined) {
        ignoreFunc = false;
    }
    if (printFuncContent == undefined) {
        printFuncContent = false;
    }    
    if (former == undefined) {
        former = "";
    }
    if (depth == undefined) {
        depth = 0;
    }
    if (path == undefined) {
        path = [];
    }

    var prefix = "";
    for (var i = 0; i < depth; i++) {
        prefix += indent;
    }

    path.push(obj);
    var encountered = false;
    for(var i = 0; i < path.length - 1; i++) {
        if(path[i] === obj) {
            encountered = true;
        }
    }

    var result = former;
    if (Object.prototype.toString.call(obj) === '[object Array]' || Object.prototype.toString.call(obj) === '[object Arguments]') {
        if (!encountered) {
            if(obj.length > 0) {
                result += "[\n";
                for (var i = 0; i < obj.length; i++) {
                    result += indent + prefix + i + ": ";
                    result += stringify(obj[i], ignoreFunc, printFuncContent, "", depth + 1, [].concat(path));
                    if (i < obj.length - 1) {
                        result += ",\n";
                    } else {
                        result += "\n";
                    }
                }
                result += prefix + "]";                 
            } else {
                result += "[ ]";
            }
        } else {
            result += "[Circular]";
        }
    } else if (Object.prototype.toString.call(obj) === '[object Object]') {
        if (!encountered) {
            var count = 0;
            var totalCount = 0;
            for (var key in obj) {
                totalCount++;
                if (Object.prototype.toString.call(obj[key]) === '[object Function]' || !ignoreFunc) {
                    count++;
                }
            }
            if(totalCount > 0) {
                result += "{\n";                
                var counter = 0;
                for (var key in obj) {
                    var value = obj[key];
                    if (Object.prototype.toString.call(value) === '[object Function]' || !ignoreFunc) {
                        counter++;
                        result += prefix + indent + key + ": " + stringify(value, ignoreFunc, printFuncContent, "", depth + 1, [].concat(path));
                        if (counter < count) {
                            result += ",\n";
                        } else {
                            result += "\n";
                        }
                    }
                }
                result += prefix + "}"                
            } else {
                result += "{}";
            }

        } else {
            result += "[Circular]"
        }
    } else if (Object.prototype.toString.call(obj) === '[object Function]') {
        if (printFuncContent) {
            var lines = ("" + obj).split("\n");
            var funcContent = "";
            var lastLine = lines[lines.length - 1];
            var lasIndent = lastLine.replace(lastLine.trim(), "")
            for(var i = 0; i < lines.length; i++) {
                if (i !== 0) {
                    funcContent += prefix;
                }
                funcContent += lines[i].replace(lasIndent, "");
                if (i !== lines.length - 1) {
                    funcContent += "\n";
                }
            }
            result += funcContent;
        } else {
            result += "_function_";
        }
    } else {
        result += obj + "";
    }
    return result;
}



/*
 * Usage: require this file, ex.
 *   var utils = require("utils.js");
 *   var publicAttrs = ['nickname', 'mood', 'inviteCode'];
 *   utils.filterUserData(publicAttrs, data); 
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
