Error.stackTraceLimit = Infinity;

var fs = require("fs");
var port = 8000;
var cacheUpdateTime = 60000;

// Retrieve
var mongo = require('mongodb'),
  MongoClient = mongo.MongoClient,
  BSON = mongo.BSONPure;

// Connect to the db
MongoClient.connect("mongodb://localhost:27017/pasta", function main (err, db) {
  if(err){
    throw err;
  }
  console.log("Connected to DB.")

  //Set up the app
  var express = require('express'),
      bodyParser = require('body-parser'),
      app = express(),
      router = express.Router(),
      render = require('express-render')(app),
      _ = require('underscore'),
      lunr = require('lunr');
  app.locals = {};
  app.locals.db = db;
  app.use(express.static(__dirname + '/public_html'));
  app.use(bodyParser.urlencoded({extended:false}));

  //Gets called after pastas are cached.
  var bootstrap = function(){
    //bootstrap the app
    app.listen(port);
    console.log("Listening on port "+port);
  }


  /* Adding needed native methods
  ---------------------------------------------- */

  lunr.Store.prototype.getAll = function () {
    return this.store;
  }

  lunr.Index.prototype.removeAll = function (emitEvent) {
    var emitEvent = emitEvent === undefined ? true : emitEvent

    var docs = this.documentStore.getAll();
    var that = this;

    _.each(docs, function(value, key){
      that.remove(key);
    });

    if (emitEvent) this.eventEmitter.emit('removeAll', false, this);
  }


  /* Setting up Cache
  ---------------------------------------------- */

  var updateCache = function(callback){
    app.locals.db.collection("pastas").find().sort({ points: -1 } ).toArray(function(err, pastas){
      app.locals.pastas = pastas;
      app.locals.idx.removeAll();
      _.each(pastas, function(pasta, i){
        pasta.title = escapeHtml(pasta.title);
        pasta.text = escapeHtml(pasta.text).replace(/\n/g,"<br />");
        pasta.fontstack = escapeHtml(pasta.fontstack);
        app.locals.idx.add(pasta);
      });
      console.log("Pastas Cached.");
      if(typeof callback === "function")
        {callback();}
    });
  }

  app.locals.idx = lunr(function(){
    this.field('_id');
    this.field('title', {boost: 30});
    this.field('text');
    this.field('tags', {boost: 5});
  })
  .ref('_id');
  app.locals.storage = lunr.Store

  var cacheUpdateTimer = setInterval(function(){
    updateCache();
  }, cacheUpdateTime);

  updateCache(bootstrap);

  /* Rendering
  ---------------------------------------------- */
  //Set up rendering
  render.init({
      render_engine: 'underscore'
    , template_type: 'html'
    , views_directory: './views'
  });
  var stylesheets = [];
  stylesheets.push("css/normalize.css");
  stylesheets.push("css/css.css");
  var scripts = [];
  scripts.push("https://code.jquery.com/jquery-2.1.3.min.js");
  scripts.push("js/main.js");



  /* Router
  ---------------------------------------------- */

  // route middleware that will happen on every request
  router.use(function(req, res, next) {
    res.status(200);
    console.log(req.method, req.url);
    next(); 
  });

  // route middleware to validate :query
  router.param('query', function(req, res, next, query) {
    //console.log('Asked for query: ' + query);
    req.query = query;
    next(); 
  });

  router.get('/api/stats', function(req, res) {
    getStats(app.locals.db, function(stats){
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(stats));
    });
  });

  router.get('/api/pasta/:query', function(req, res) {
    getPasta(app, req.query, function(pastas){
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(pastas));
    });
  });

  router.post('/api/pasta/:query', function(req, res) {
    req.body._id = req.query;
    updatePasta(app.locals.db, req.body, function(result){
      if(result===false){
        result = "An error occured.";
      }
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(result));
    });
  });

  router.post('/api/pasta/', function(req, res) {
    putPasta(app.locals.db, req.body, function(err, result){
      res.setHeader('Content-Type', 'application/json');
      if(err){
        res.status(401);
        res.send(JSON.stringify(err[0]));
      }
      else{
        res.send(JSON.stringify(true));
      }
    });
  });

  router.all('/:query', function(req, res) {
    getPasta(app, req.query, function(pastas){
      var locals = {title: "Pastamaker: "+req.query, pastas: pastas, query: req.query};
      res.render('index.html', 
                { stylesheets: stylesheets, scripts: scripts, locals: locals}, 
                function(err,str) { 
                  if(!err){
                    res.send(str); 
                  }
                  else{
                    console.log(err);
                    res.sendStatus(500);
                  }
                });
    });
  });

  router.all('/', function(req, res) {
    var locals = {title: "Pastamaker"};
    res.render('index.html', 
              { stylesheets: stylesheets, scripts: scripts, locals: locals}, 
              function(err,str) { 
                if(!err){
                  res.send(str); 
                }
                else{
                  console.log(err);
                }
              });
  });

  // apply the routes to our application
  app.use('/', router);

  app.use(function(req,res) { 
    /*res.render('404', 
               { locals: {'title':'Not Found'}, }, 
               function(err,str) { res.status(404).send(str); } );*/
    res.status(404).send("404");
  });


  /* Utilities
  ---------------------------------------------- */
  function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  }
  function escapeHtml(unsafe) {
      return unsafe
           .replace(/&/g, "&amp;")
           .replace(/</g, "&lt;")
           .replace(/>/g, "&gt;")
           .replace(/"/g, "&quot;")
           .replace(/'/g, "&#039;");
   }
  var putPasta = function(db, pasta, callback){
    if(typeof pasta.title==="string" && typeof pasta.text==="string" && pasta.title.length>0 && pasta.text.length>0){
      var collection = db.collection("pastas");
      //var titleRe = new RegExp("^"+escapeRegExp(pasta.title)+"$", "gi");
      var textRe = new RegExp("^"+escapeRegExp(pasta.text)+"$", "gi");
      var filter = {/*$or: [ { title: titleRe }, { text: textRe } ] */ text: textRe };
      collection.find( filter ).toArray(function(err, pastas){
        if(err){
          console.log(err);
          callback(err, false);
        }

        if(pastas.length>0){
          callback(["Pasta with that text already exists"], false);
        }
        else{
          if(typeof pasta.fontstack!=="string" || pasta.fontstack.length<1)
            {pasta.fontstack = "serif"}
          if(typeof pasta.tags!=="string" || pasta.tags.length<1)
            {pasta.tags = ""}
          var doc = {
            "title": pasta.title, 
            "text": pasta.text, 
            "tags": pasta.tags,
            "fontstack": pasta.fontstack,
            "points": 0};
            console.log(doc);
          collection.insert(doc, callback);
        }
      });
    }
    else{
      callback(["Title and/or text invalid."], false);
    }
  }
  var getPasta = function(app, query, callback){
    var limit = 10 + 3*(query.length-1)*(query.length-1);
    var pastas = app.locals.idx.search(query).map(function (resultPasta) {
      return app.locals.pastas.filter(function (pasta) {
        return pasta._id+"" === resultPasta.ref; 
      })[0];
    });
    callback(pastas.slice(0, limit));
  }
  var updatePasta = function(db, params, callback){
    var collection = db.collection("pastas");
    var pointsToAdd = params.action==="like" ? 1 : -1;
    var update = {$inc: { points: pointsToAdd }};
    var filter = { _id: new BSON.ObjectID(params._id) };
    collection.update(filter, update, function(err, result){
      if(!err){
        callback("Updated successfully");
      }
      else{
        console.log(err);
        callback(false);
      }
    });
  }
  var getStats = function(db, callback){
    var collection = db.collection("pastas");
    collection.find( {} ).sort( { points: -1 } ).toArray(function(err, pastas){
      var count = pastas.length;
      if(err){
        console.log(err);
        callback(false);
      }
      else{
        callback({count: count});
      }
    });
  }

});