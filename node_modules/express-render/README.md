Why express render?
==================

Rendering templates in express is always a headache. It sucks. Always. This makes it easy.

Install
------
<pre>
npm install express-render
</pre>

Quick Start
-----------
express render can work with any rendering engine that [consolidate](https://github.com/visionmedia/consolidate.js/) supports
<pre>
var server = require('express')()
  , render = require('express-render')(server)
  
render.init({
    render_engine: 'underscore'
  , template_type: 'html'
  , views_directory: './'
})

server.get('/', function(request, response) {
    response.render('index.html', {
        foo: bar
    })
})
server.listen(some port)
</pre>
