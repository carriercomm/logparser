#!/bin/node

//throw an exception lol
var parser = require('./prsr.js');

var config = require('./config.json');

function tryNginx(){
    if (config.nginxFilePath) {
        console.log();
        console.log();
        console.log('parsing nginx sample file. file path is "' + config.nginxFilePath + '"');

        parser.parseNginx(config.nginxFilePath, function (ret) {
            var bads = ret[0];
            var stats = ret[1];

            console.log("1. List of entries which could not be counted: ");
            console.log(bads);
            console.log();
            console.log();
            console.log("2. Staticstics for log file '" + config.nginxFilePath + "'");
            console.log(stats);

            tryMaxcdn()
        });
    }
    else tryMaxcdn();
}

function tryMaxcdn(){
    if (config.maxcdnFilePath) {
        console.log();
        console.log();
        console.log('parsing maxcdn sample file. file path is "' + config.maxcdnFilePath + '"');


        parser.parseMaxcdn(config.maxcdnFilePath, function (ret) {
            var bads = ret[0];
            var stats = ret[1];
            //   console.log("1. List of entries which could not be counted: ");
            // console.log(bads);
            // console.log();
            // console.log();
            console.log("1. Staticstics for log file '" + config.maxcdnFilePath + "'");
            console.log(stats);
            //  console.log ('strings parsed: '+ret);
        });
    }
}

tryNginx();

