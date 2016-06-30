"use strict";

const dmcreator = require("dmcreator");
const fs = require("fs");
const getPixels = require("get-pixels");
const _ = require("underscore");
const im = require("imagemagick");

var imagesPath = "./images/";

const decodePixels = function (err, pixels) {
    if (err) {
        err.should.be.null();
    } else {
        var data = new Buffer(pixels.data);
        return dmcreator.decodeDm({
            cols: pixels.shape[0],
            rows: pixels.shape[1],
            channels: pixels.shape[2] 
        }, data, 10000);
    }
}

const decodeFile = function(file, path) {
    const p = new Promise(function(resolve, reject) {
        getPixels(path+file, function(err, pixels) {
            const filename = file.split("_")[0];
            if (err) {
                console.log("ERROR", filename, err);
                reject(err);
            }
            else {
                const res = decodePixels(err, pixels);
                if (res.success) {
                    if (filename === res.text)
                        console.log("OK", file);
                    else
                        console.log("WRONG decoding:", file, res.text);
                }
                resolve(res);
            }
        });
    });
    return p;
}

const blurAndDecodeFile = function(file, path) {
    const p = new Promise(function(resolve, reject) {
        var outpath = "./convert/"
        im.convert([path+file, "-blur", "5x2", outpath+file], function(err) {
            if (err) {
                console.log("Blur failed:", err);
                reject(err);
            } else {
                //console.log("converted, now decoding", file);
                decodeFile(file, outpath).then(resolve);
            }
        });
    })
    return p;
}

const reduceSizeAndDecodeFile = function(file, path, percentage) {
    const p = new Promise(function(resolve, reject) {
        var outpath = "./convert/"
        var outfile = "reduced_"+file
        im.convert([path+file, "-resize", percentage, outpath+outfile], function(err) {
            if (err) {
                console.log("Resize failed:", err);
                reject(err);
            } else {
                decodeFile(outfile, outpath).then(resolve);
            }
        });
    })
    return p;
}

const decodeReduce50 = function(file, path) {
    return reduceSizeAndDecodeFile(file, path, "50%");
}

const decodeReduce25 = function(file, path) {
    return reduceSizeAndDecodeFile(file, path, "25%");
}

function functionName(fun) {
    var ret = fun.toString();
    ret = ret.substr("function ".length);
    ret = ret.substr(0, ret.indexOf("("));
    return ret;
}

fs.readdir(imagesPath, function(err, files) {
    let index = 0;
    let successCount = 0;
    let failedCount = 0;

    const applyDecodeFunction = function(file, path, functions) {
        let decoded = false;
        const p = new Promise(function(resolve, reject) {
            const decodeIteration = function(functionsList) {
                if (!_.isEmpty(functionsList)) {
                    const func = _.first(functionsList);
                    console.log("Decoding with", func.name);
                    func.f(file, path).then(function(res) {
                        if (res.success) {
                            resolve(res);
                        } else {
                            decodeIteration(_.rest(functionsList));
                        }
                    });
                } else {
                    resolve({success:false});
                }
            }
            decodeIteration(functions);
        });
        return p;
    };

    const decodeFunctions = [
        {name:"Default", f:decodeFile},
        {name:"Reduce25", f:decodeReduce25},
        {name:"Reduce50", f:decodeReduce50},
        {name:"Blur", f:blurAndDecodeFile}
    ];
    const processFile = function() {
        if (index < _.size(files)) {
            const file = files[index];
            if (!file.startsWith(".")) {
                index += 1;
                applyDecodeFunction(file, imagesPath, decodeFunctions).then(function(res) {
                    if (res.success) {
                        successCount += 1;
                    } else {
                        failedCount += 1;
                        console.log("FAILED", file);
                    }
                    processFile();
                });
            } else {
                processFile();
            }
        } else {
            console.log("------------------------------");
            console.log("Done.");
            console.log("Success:", successCount);
            console.log("Failed:", failedCount);
        }
    }

    processFile();
});
