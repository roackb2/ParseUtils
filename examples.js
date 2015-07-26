var utils = require("utils.js");
var WaterFall = utils.WaterFall;
var AsyncWhile = utils.AsyncWhile;
var query = utils.query

// example for WaterFall
function waterFallExample() {
    var waterFall = new WaterFall();

    for (var i = 0; i < 5; i++) {
        waterFall.push(function(pageNumber) {
            console.log(pageNumber)
            return Parse.Cloud.run("dispatcher", {
                device: "ios",
                version: "1.1.2",
                action: "queryNewPosts",
                username: "hello@gmail.com",
                pageQuantum: 12,
                pageNumber: pageNumber
            });
        }, [i]);
    }

    waterFall.start().then(function(results) {
        results.forEach(function(result) {
            result.forEach(function(post) {
                console.log("content:\n" + post.get("content"))
                console.log("createdAt: " + post.createdAt + "\n");
            })
        })
    })
}

// example for AsyncWhile
function asyncWhileExample() {
    var janBegin = new Date("2015-1-1");
    var janEnd = new Date("2015-1-31");
    var now = new Date().getTime();

    var date = new Date("2015-2-22");

    var pageQuantum = 600;

    var asyncWhile = new AsyncWhile(function(action, params) {
        console.log(params);
        return Parse.Cloud.run(action, params);
    }, function(result) {
        if (result.length == pageQuantum) {
            return true;
        } else {
            return false;
        }
    }, function(action, params) {
        params.pageNumber++;
    })

    asyncWhile.start(["dispatcher", {
        device: "android",
        version: "1.3.8.2",
        action: "queryNewsfeed",
        username: "hello@gmail.com",
        pageQuantum: pageQuantum,
        pageNumber: 0,
        begin: janBegin,
        end: janEnd
    }]).then(function(results) {
        console.log("pages count: " + results.length);
        results.forEach(function(result, index) {
            console.log("\n\n\tNo. " + index + " page, count: " + result.length + "\n\n");
            result.forEach(function(post) {
                console.log("content:\n" + post.get("content"));
                console.log("\ncreatedAt: " + post.createdAt);
            })
        })
    })
}

// example for query
function queryExample() {
    query("Post", function(query) {
        query.equalTo("nickname", "helloWorld");
        query.include("author");
    }).then(function(posts) {
        for (var i = 0; i < posts.length; i++) {
            console.log(posts[i].get("author").get("nickname"));
        }
    })
}
