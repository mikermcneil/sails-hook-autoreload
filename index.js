var path = require('path');
module.exports = function(sails) {


  // oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo
  // WARNING: THIS HOOK USES PRIVATE, UNDOCUMENTED APIs THAT COULD CHANGE AT ANY TIME
  // oooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooooo
  // This hook uses private APIs of Sails core and core hooks in its implementation.
  // These private APIs could change **at any time**, including in a patch release of Sails,
  // which means if you use them in your Sails app or hook, then when a new version of Sails is
  // installed, _your app or hook could stop working_. In other words, avoid using these private APIs
  // in your own app, hook, tutorial, example, etc.  If you must use them, PLEASE INCLUDE THIS WARNING
  // AT THE TOP OF THE RELEVANT FILE(S) OR CODE SAMPLE(S).  Similarly, if you use THIS PACKAGE in your
  // app, hook, tutorial, example, etc., then PLEASE INCLUDE THIS WARNING in your source code.
  // ----------------------------------------------------------------------------------------------------



  return {

    /**
     * Default configuration
     *
     * We do this in a function since the configuration key for
     * the hook is itself configurable, so we can't just return
     * an object.
     */
    defaults: {

      __configKey__: {
        // Set autoreload to be active by default
        active: true,
        //use polling to watch file changes
        //slower but sometimes needed for VM environments
        usePolling: false,
        // Set dirs to watch
        dirs: [
          path.resolve(sails.config.appPath,'api','controllers'),
          path.resolve(sails.config.appPath,'api','models'),
          path.resolve(sails.config.appPath,'api','services'),
          path.resolve(sails.config.appPath,'config','locales')
        ],
        overrideMigrateSetting: true,
        // Ignored paths, passed to anymatch
        // String to be directly matched, string with glob patterns,
        // regular expression test, function
        // or an array of any number and mix of these types
        ignored: []
      }
    },

    /**
     * Initialize the hook
     * @param  {Function} cb Callback for when we're done initializing
     */
    initialize: function(cb) {

      var self = this;

      // If the hook has been deactivated, or controllers is deactivated just return
      if (!sails.config[this.configKey].active || !sails.hooks.controllers) {
        sails.log.verbose("Autoreload hook deactivated.");
        return cb();
      }

      // Initialize the file watcher to watch controller and model dirs
      var chokidar = require('chokidar');

      // Watch both the controllers and models directories
      var watcher = chokidar.watch(sails.config[this.configKey].dirs, {
        // Ignore the initial "add" events which are generated when Chokidar
        // starts watching files
        ignoreInitial: true,
        usePolling: sails.config[this.configKey].usePolling,
        ignored: sails.config[this.configKey].ignored
      });

      sails.log.verbose("Autoreload watching: ", sails.config[this.configKey].dirs);

      // Whenever something changes in those dirs, reload the ORM, controllers and blueprints.
      // Debounce the event handler so that it only fires after receiving all of the change
      // events.
      //
      //  (sails.util` is a private Sails API and could change at any time! Do not use!)
      watcher.on('all', sails.util.debounce(function(action, path, stats) {

        sails.log.verbose("Detected API change -- reloading controllers / models...");

        // don't drop database
        sails.config.models.migrate = sails.config[self.configKey].overrideMigrateSetting ? 'alter' : sails.config.models.migrate;

        // Reload controller middleware (private Sails API -- could change at any time!)
        sails.hooks.controllers.loadAndRegisterControllers(function() {

          // Wait for the ORM to reload (private Sails API -- could change at any time!)
          sails.once('hook:orm:reloaded', function() {

            // Reload locales (private Sails API -- could change at any time!)
            sails.hooks.i18n.initialize(function() {});

            // Reload services (private Sails API -- could change at any time!)
            sails.hooks.services.loadModules(function() {});

            // Reload blueprints on controllers (private Sails API -- could change at any time!)
            sails.hooks.blueprints.extendControllerMiddleware();

            // Flush router  (private Sails API -- could change at any time!)
            sails.router.flush();

            // Reload blueprints  (private Sails API -- could change at any time!)
            sails.hooks.blueprints.bindShadowRoutes();

          });

          // Reload ORM  (private Sails API -- could change at any time!)
          sails.emit('hook:orm:reload');

        });

      }, 100));

      // We're done initializing.
      return cb();

    },

  };

};
