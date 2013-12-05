/*
** © 2013 by Philipp Dunkel <pip@pipobscure.com>. Licensed under MIT-License.
*/
/*jshint node:true, browser:false*/
'use strict';

module.exports = Stagger;

var Abstract = require('kvs-abstract');
var async = require('async');

Abstract.bequeath(Stagger);
function Stagger(stores, options) {
  Abstract.instantiate(this);

  this.stores = [].concat(stores);

  options = options || {};
  this.percolate = !!options.percolate; // Write a value that was not found on get to the stores where it wasn't found in case it is found below
  this.writeDepth = parseInt(options.writeDepth || 1); // Write just to the first service, or to all
  this.writeDepth = (isNaN(this.writeDepth) ? 1 : Math.min(this.writeDepth, stores.length)) || 1;
  this.removeDepth = parseInt(options.removeDepth || 1);
  this.removeDepth = (isNaN(this.removeDepth) ? this.writeDepth : Math.min(this.removeDepth, stores.length)) || this.writeDepth;
}

Stagger.prototype._get = function(name, callback) {
  var self = this;
  var value, stores=[];
  async.eachSeries(this.stores, function(store, callback) {
    if (value) callback(null, value);
    store.get(name, function(err, val) {
      value = val;
      if (!value) stores.push(store);
      callback();
    });
  }, function() {
    if (!self.percolate) return callback(null, value || null);
    async.each(stores.slice(0, this.writeDepth), function(store, callback) {
      store.set(name, value, callback);
    }, function(err) {
      callback(err || null, value);
    });
  });
};

Stagger.prototype._set = function(name, value, callback) {
  var stores = this.stores.slice(0, this.writeDepth);
  async.each(stores, function(store, callback) {
    store.set(name, value, callback);
  }, callback);
};

Stagger.prototype._remove = function(name, callback) {
  var stores = this.stores.slice(0, this.removeDepth);
  async.each(stores, function(store, callback) {
    store.remove(name, callback);
  }, callback);
};

Stagger.prototype._list = function(name, callback) {
  async.map(this.stores, function(store, callback) {
    store.list(name, callback);
  }, function(err, vals) {
    if (err) return callback(err);
    var res = {};
    vals.forEach(function(item) {
      if (!item || !item.count) return;
      item.values.forEach(function(item) { res[item]=true; });
    });
    res = { values:Object.keys(res) };
    res.count = res.values.length;
    callback(null, res);
  });
};