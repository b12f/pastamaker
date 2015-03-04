var server = require('express')()
  , should = require('should')
  , request = require('request')
  , _ = require('underscore')

describe('Initialization', function() {
    it('should require server be passed in', function() {
        try {
            var render = require('../index')()
        } catch(e) {
            e.message.should.equal('Render requires first argument to be an instance of express')
        }
    })
    it('should error if an instance of express is not passed in', function() {
        try {
            var render = require('../index')({
                engine: function() {}
            })
        } catch(e) {
            e.message.should.equal('Render requires first argument to be an instance of express')
        }
    })
    it('should set correct properties to render object', function() {
        var render = require('../index')(require('express')())
        render.should.have.property('server')
        render.should.have.property('cons')
        render.should.have.property('args')
    })
})
describe('Init', function() {
    var render
    beforeEach(function() {
        render = require('../index')(require('express')())
    })
    it('should default values if args not passed in', function() {
        render.init()
        render.args.should.have.property('render_engine', 'underscore')
        render.args.should.have.property('template_type', 'html')
        render.args.should.have.property('views_directory', './')
    })
    it('should be able to override values', function() {
        var overrides = {
            render_engine: 'jade'
          , template_type: 'htm'
          , views_directory: '../'
        }
        render.init(overrides)
        render.args.should.have.property('render_engine', overrides.render_engine)
        render.args.should.have.property('template_type', overrides.template_type)
        render.args.should.have.property('views_directory', overrides.views_directory)
    })
    it('should not let you set render engine if it doesn\'t exist', function() {
        var overrides = {
            render_engine: 'haml'
          , template_type: 'htm'
          , views_directory: '../'
        }
        render.init(overrides)
        render.args.should.have.property('render_engine', overrides.render_engine)
        render.args.should.have.property('template_type', overrides.template_type)
        render.args.should.have.property('views_directory', overrides.views_directory)
    })
})
describe('Render', function() {
    var render
      , express = require('express')
      , server
    beforeEach(function() {
        server = express()
        render = require('../index')(server)
    })
    it('should render underscore template', function(done) {
        render.init({
            views_directory: './views/'
        })
        server.get('/', function(request, response) {
            response.render('index.html', {
                name: 'Tyke'
            })
        })
        var listener = server.listen(9000)
        request('http://127.0.0.1:9000', function(error, response, body) {
            listener.close()
            body.should.equal('Hello, Tyke')
            done()
        })
    })
    it('should allow to pass in render engine in order to override various settings', function(done) {
        render.init({
            views_directory: './views/'
          , template_settings: {
                interpolate : /\{\{-([\s\S]+?)\}\}/g
              , escape      : /\{\{([^-]|[^-][\s\S]+?)\}\}/g
              , evaluate    : /\{\[([\s\S]+?)\]\}/g
            }

        })
        server.get('/', function(request, response) {
            response.render('mustache.html', {
                name: 'Tyke'
            })
        })
        var listener = server.listen(9000)
        request('http://127.0.0.1:9000', function(error, response, body) {
            listener.close()
            body.should.equal('Hello, Tyke')
            done()
        })
    })
})
