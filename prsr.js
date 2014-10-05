#!/bin/node
var fs = require('fs');
var _ = require('underscore');

var utils = require('./utils');

// --- error throw/handle unit. ---
// currently err unit is a single function 'thrrrow'
var thrrrow= utils.ERR.thrrrow;

// # unit test code :)
var testErr = function() {
    console.log();
    console.log("----------------------");
    console.log("error testing function\nwas called.");
    console.log("going to throw a error");

    thrrrow({"where": "в терновый куст"});
    console.log();
    console.log('called utils.ERR.thhhrow');
    console.log("------------------------");
    console.log();
};
// / unit test code ends

// # unit test setup
testThrowError = false;

// # unit test runner
if (testThrowError) {    testErr();     }
// --- unit end. ---

//localizing needed PARSER' properties
var PARSER = utils.PARSER;

var tryMatcherObject = PARSER.tryMatcherObject;
var tryMatchingFunction = PARSER.tryMatchingFunction;

var endMatcher = PARSER.storeNginx.responseCodeMatcher;
var testQuote = PARSER.storeNginx.testQuote;

var testNewline = PARSER.storeMaxcdn.testNewline;

//return position of next log item start
var nextStartNginx = function(buffer, position) {
    while (buffer.length >= position++ && !tryMatchingFunction(buffer, position, testQuote)){
    }
    return position;
};

//return position of next log item start
var nextStartMaxcdn = function(buffer, position) {
    while (buffer.length >= position++ && !tryMatchingFunction(buffer, position, testNewline)){
    }
    return position;
};

/**
 * replacements for _.countBy that allows instant counting,
 * without need to store all data in ram berfore count
 * @param statsKey -what property inside stats object is handled
 * @param itemProp - value of that property for currently scanned item
 * @param stats - object that holds counters for parsed file
 * @private
 */
// TODO: namespacing
var __count = function(statsKey, itemProp, stats) { //todo: move to
    if (!stats[statsKey]) stats[statsKey] = {};
    if (itemProp) {
        if (!stats[statsKey][itemProp]) {
            stats[statsKey][itemProp] = 0;
        }
        stats[statsKey][itemProp]++;
    }
};

var parseNginx = function(filename, callback) {

    var bads = []; //here be
    var stats = { 'By project': {}, 'By response code': {}, 'By protocol': {}, 'By method': {},
        'GETs count': 0, 'HEADs count': 0, 'Errors count': 0, 'Multiple queries': 0, 'Single queries': 0
    };

    function _check(item, str) {
        if (!item.key || !item.method || !item.response || !item.protocol) {
            bads.push({ str: str.split('?')[0], item: item, meta:"undefined key or method or response or protocol"});
        }
    }

    function _count(item){
        __count('By project', item.key, stats);
        __count('By response code', item.response, stats);
        __count('By protocol', item.protocol, stats);
        __count('By method', item.method, stats);
    }

    fs.readFile(filename, function (err, file) {
        // check if file read successful
        if (err) { callback([err, err]); return;}

        var inside = false, prev, next = 0; //buffer parsing finite-state-automate

        do {
            prev = next;
            next = nextStartNginx(file, prev + 1);

            if (tryMatcherObject(file, next, PARSER.storeNginx.testGetObject)) {
                stats['GETs count']++;
                inside = true;
                // console.log("get at " + next);
            } else if (tryMatcherObject(file, next, PARSER.storeNginx.testHeadObject)) {
                stats['HEADs count']++;
                inside = true;
                // console.log("head at " + next);
            }

            if (inside) {
                var fin = nextStartNginx(file, next + 1);

                if (!tryMatcherObject(file, fin, endMatcher)) {
                    stats['Errors count']++;
                }
                else {

                    var str = file.toString('ascii', next, fin + 5);
                    var string = str.split(' ');
                    var q = {
                        method: string[0].replace('"', ''),
                        protocol: string[2].replace('"', ''),
                        response: string[3]
                    };

                    string = string[1].split('?')[0];
                    //multiple query
                    if (string.indexOf('/g/') == 0) {
                        stats['Multiple queries']++;
                        string = string.split('/g/')[1].split(',');
                        r = [];
                        _.each(string, function (s) {
                            r.push(_.extend({}, q, {key: s.split('@')[0]}));
                        });
                        _.each(r, function (item) {
                            _check(item, str);
                            _count(item);
                        })
                        //single query
                    } else {
                        stats['Single queries']++;
                        string = string.split('/')[1];
                        q.key = string;
                        _check(q, str);
                        _count(q);
                    }
                }
                inside = false;
            }
        } while (prev != next && tryMatchingFunction(file, next, testQuote));

        stats['By project'] = JSON.stringify(stats['By project']);
        stats['Bad entries by log string'] = _.countBy(bads, 'str');
        callback([bads, stats]); //TODO: define some stable logical interface here
    });

};

var parseMaxcdn = function(filename, callback) {

    var bads = [];
    var stats = {
       'Errors count': 0, 'Multiple queries': 0, 'Single queries': 0,
            'By response code': {}, 'By project': {}
    };

    function _check(item, str) {
        if (!item.key || !item.response ) {
            bads.push({ str: str, item: item, meta: 'did not pass _check()'});
        }
    }

    // so we do not need to store 1M records only to use _.countBy on them..
    function _count(item){
        if (item.key
            && item.key.indexOf("&") == -1
            && item.key.indexOf("+") == -1
            && item.key.indexOf("=") == -1 )
            __count('By project', item.key, stats);
        __count('By response code', item.response, stats);
    }

    fs.readFile(filename, function (err, file) {
        // check if file read successful
        if (err) { callback([err, err]); return;}

        var prev, next = -1; //buffer parsing finite-state-automate

        do {
            prev = next; //those are positions inside buffer
            next = nextStartMaxcdn(file, prev + 1);
            var str = file.toString  ('ascii', prev+1, next); //cut between 'prev' and next item start
            //log item format is tab-separated values
            var string = str.split('	');
            if (string.length < 8) {
                console.log(str);
                bads.push({str: str, meta: "item split by tabs contain less <8 parts"});
                continue;
            }

            var q = {
              //  querydomain: string[0],              //  from: string[1],              //  date: string[2],
                path: string[3],
                response: string[4]
              //  length: string[5],              //  domain: string[6],              //  client: string[7]
            };

            string = q.path; // /g/<projects,> or /<project>
            if (!string ) { bads.push({str: str, meta:"could not extract path"}); }
            else {
                //multiple
                if (string && string.indexOf('/g/') == 0) {
                    stats['Multiple queries']++;
                    string = string.split('/g/')[1].split(',');
                    r = [];
                    _.each(string, function (s) {
                        r.push(_.extend({}, q, {key: s.split('@')[0]}));
                    });
                    _.each(r, function (item) {

                        _check(item, str);
                        _count(item);
                    });
                //single
                } else {
                    stats['Single queries']++;
                    string = string.split('/')[1];
                    q.key = string;
                    _check(q, str);
                    _count(q);
                }
            }
        } while (prev != next && tryMatchingFunction(file, next, testNewline));

        stats['By project'] = JSON.stringify(stats['By project']);
        stats['Bad entries by log string'] =  _.countBy(bads, 'str');
        callback([bads, stats]/*[bads, stats]*/); //TODO: define some stable logical interface here
    });

};

module.exports = {
    parseNginx: parseNginx,
    parseMaxcdn: parseMaxcdn
};