var _ = require('underscore')
   , self = this

 var render = function(server, options) {
    if(!(this instanceof render)) {
        return new render(server, options)
    }

    options = options || {}
    server = server || {}
    if(_.indexOf([typeof server.engine, typeof server.set], 'undefined') > -1) {
        throw new Error('Render requires first argument to be an instance of express')
    }

    this.server = server
    this.cons = options.consolidate || require('consolidate')
    this.args = {}
}
render.prototype.init = function(args) {
    _.extend(this.args, {
        render_engine: 'underscore'
      , template_type: 'html'
      , views_directory: './'
    }, args)

    if(this.args.render_engine === 'underscore' && this.args.template_settings) {
        _.templateSettings = this.args.template_settings
    }

    this.server.engine('.'+this.args.template_type, this.cons[this.args.render_engine])
    this.server.set('view engine', this.args.template_type)
    this.server.set('views', this.args.views_directory)

    var self = this
}

module.exports = render
