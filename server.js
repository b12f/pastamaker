/* Global Variables
---------------------------------------------- */
var port = 8000;
var cacheUpdateTime = 60 * 1000; // 1 minute
var voteCooldown = 24 * 60 * 60 * 1000; // 24 hours
var postCooldown = 2 * 60 * 1000; // 2 minutes

/* Database setup
---------------------------------------------- */
var mongo = require('mongodb'),
  MongoClient = mongo.MongoClient,
  BSON = mongo.BSONPure;

// Connect to the db
MongoClient.connect("mongodb://localhost:27017/pasta", function main (err, db) {
  if(err){
    throw err;
  }
  console.log("Connected to DB.")

  /* App setup and local variables
  ---------------------------------------------- */
  var express = require('express'),
      bodyParser = require('body-parser'),
      app = express(),
      router = express.Router(),
      render = require('express-render')(app),
      _ = require('underscore'),
      lunr = require('lunr');
  app.locals = {};
  app.locals.db = db;
  app.locals.userHistory = {};
  app.use(express.static(__dirname + '/public_html'));
  app.use(bodyParser.urlencoded({extended:false}));


  /* Adding needed methods
  ---------------------------------------------- */

  /* Gets all documents in the lunr cache
   *
   * returns: object
   */
  lunr.Store.prototype.getAll = function () {
    return this.store;
  }

  /* Removes all documents in the lunr index
   *
   * arguments: boolean emitEvent
   */
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

  /* Updates the cache
   *
   * arguments: function callback
   *
   */
  app.updatePastaCache = function(callback){
    var app = this;
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

  /* Cleans the userhistory so we are not keeping more data in memory than we need.
   * All expired actions and empty userhistories are deleted.
   */
  app.cleanUserHistory = function(){
    var app = this;
    var now = (+new Date());
    _.each(app.locals.userHistory, function(history, ip){
      _.each(history, function(action, index){
        //The action cooldown has ended
        if((action.name==="Vote" && action.time + voteCooldown < now) ||
           (action.name==="Post" && action.time + postCooldown < now)){
          delete app.locals.userHistory[ip][index];
        }
      });
      if(history.length===0){
        delete app.locals.userHistory[ip];
      }
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
    app.updatePastaCache();
    app.cleanUserHistory();
  }, cacheUpdateTime);

  app.updatePastaCache(function(){
    //bootstrap the app
    app.listen(port);
    console.log("Listening on port "+port);
  });

  /* Rendering
  ---------------------------------------------- */
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
    req.ip = req.headers['x-forwarded-for'] ||
     req.connection.remoteAddress ||
     req.socket.remoteAddress ||
     req.connection.socket.remoteAddress;
    res.status(200);
    next();
  });

  // route middleware to get :query
  router.param('query', function(req, res, next, query) {
    req.query = query;
    next();
  });

  router.get('/api/stats', function(req, res) {
    app.getStats(function(stats){
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(stats));
    });
  });

  router.get('/api/pasta/:query', function(req, res) {
    app.getPasta(req.query, function(pastas){
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(pastas));
    });
  });

  router.post('/api/pasta/:query', function(req, res) {
    req.body._id = req.query;
    app.updatePasta(req.body, req.ip, function(result){
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify(result));
    });
  });

  router.post('/api/pasta/', function(req, res) {
    app.putPasta(req.body, req.ip, function(err, result){
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
    app.getPasta(req.query, function(pastas){
      var locals = {title: "Pastamaker: "+req.query, pastas: pastas, query: req.query, cooldowns: {vote: "1 day", post: "2 minutes"}};
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
    res.status(404).send("404 Not Found");
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

  /* Functions
  ---------------------------------------------- */

  /* Inserts a new pasta into the database
   *
   * arguments: object app, object pasta, string ip, function callback
   */
  app.putPasta = function(pasta, ip, callback){
    var app = this;
    var db = app.locals.db;
    if(!app.allowedToPost(ip)){
      callback(["Please wait "+(postCooldown/1000)+" seconds between posting."], false);
    }
    else if( typeof pasta.title!=="string"
          || typeof pasta.text!=="string"
          || pasta.title.length===0
          || pasta.text.length===0
          ){
      callback(["Title and/or text invalid."], false);
    }
    else{
      var collection = db.collection("pastas");
      var textRe = new RegExp("^"+escapeRegExp(pasta.text)+"$", "gi");
      var filter = { text: textRe };
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
            "points": 0,
            "ip": ip};
          collection.insert(doc, function(err, result){
            app.addUserHistory( ip, "Post", pasta.text);
            callback(err, result);
          });
        }
      });
    }
  }

  /* Gets pasta from cache
   *
   * arguments: object app, string query, function callback
   */
  app.getPasta = function(query, callback){
    var app = this;
    var limit = 10 + 3*(query.length-1)*(query.length-1);
    var pastas = app.locals.idx.search(query).map(function (resultPasta) {
      return app.locals.pastas.filter(function (pasta) {
        return pasta._id+"" === resultPasta.ref;
      })[0];
    });
    callback(pastas.slice(0, limit));
  }

  /* Updates the votecount of a pasta
   *
   * arguments: object app, object params, string ip, function callback
   */
  app.updatePasta = function(params, ip, callback){
    var app = this;
    var db = app.locals.db;
    var collection = db.collection("pastas");
    var pointsToAdd = params.action==="like" ? 1 : -1;
    var update = {$inc: { points: pointsToAdd }};
    var filter = { _id: new BSON.ObjectID(params._id) };
    if(app.allowedToVote(ip, "Vote", params._id)){
      collection.update(filter, update, function(err, result){
        if(!err){
          app.addUserHistory(ip, "Vote", params._id);
          callback("Updated successfully");
        }
        else{
          console.log(err);
          callback(false);
        }
      });
    }
    else{
      callback(false);
    }
  }

  /* Gets pastamaker stats
   *
   * arguments: object app, function callback
   */
  app.getStats = function(callback){
    var app = this;
    var db = app.locals.db;
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

  /* Inserts a new action into a users history
   *
   * arguments: object app, string ip, string name, boolean or string _id
   */
  app.addUserHistory = function(ip, name, _id){
    var app = this;
    if(!app.locals.userHistory[ip])
      {app.locals.userHistory[ip] = [];}
    app.locals.userHistory[ip].push({time: (+new Date()), name: name, _id: _id});
  }

  /* Checks if a user is allowed to vote on a pasta
   *
   * arguments: object app, string ip, string name, string _id
   *
   * returns: boolean
   */
  app.allowedToVote = function(ip, name, _id){
    var app = this;
    if(app.locals.userHistory[ip]){
    var allowed = true;
        _.each(app.locals.userHistory[ip], function(action, i, list){
            if(action.name==="Vote" && action._id===_id &&  action.time + voteCooldown > (+new Date())){
                allowed = false;
            }
        });
      return allowed;
    }
    else{
      return true;
    }
  }

  /* Checks if a user is allowed to post a new pasta
   *
   * arguments: object app, string ip
   *
   * returns: boolean
   */
  app.allowedToPost = function(ip){
    var app = this;
    if(app.locals.userHistory[ip]){
        var allowed = true;
      return _.each(app.locals.userHistory[ip], function(action, i, list){
        if(action.name==="Post" && action.time + postCooldown > (+new Date())){
          allowed = false;
        }
      });
      return allowed;
    }
    else{
      return true;
    }
  }

});