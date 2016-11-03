
const packager = require('electron-packager');
const path = require('path');
const tmpdir = path.resolve(require('os').tmpdir(), 'nylas-build');
const fs = require('fs-plus');
const compile = require('electron-compile');

module.exports = (grunt) => {
  function runResolveSymlinks(buildPath, electronVersion, platform, arch, callback) {
    console.log(" -- Moving symlinked node modules / internal packages into build folder.")

    const dirs = [
      path.join(buildPath, 'internal_packages'),
      path.join(buildPath, 'node_modules'),
    ];

    dirs.forEach((dir) => {
      fs.readdirSync(dir).forEach((packageName) => {
        const packagePath = path.join(dir, packageName)
        const realPackagePath = fs.realpathSync(packagePath).replace('/private/', '/')
        if (realPackagePath !== packagePath) {
          console.log(`Copying ${realPackagePath} to ${packagePath}`);
          fs.removeSync(packagePath);
          fs.copySync(realPackagePath, packagePath);
        }
      });
    });

    callback();
  }

  function runElectronCompile(buildPath, electronVersion, platform, arch, callback) {
    console.log(" -- Running electron-compile. For extended debug info, run with DEBUG=electron-compile:*")

    const cachePath = path.join(buildPath, '.cache');
    try {
      fs.mkdirSync(cachePath);
    } catch (err) {
      //
    }

    const host = compile.createCompilerHostFromProjectRootSync(buildPath, cachePath)

    host.compileAll(buildPath, (filepath) => {
      const relativePath = filepath.replace(buildPath).replace('undefined/', '/');
      return relativePath.startsWith('/src') || relativePath.startsWith('/internal_packages') || relativePath.startsWith('/static');
    })
    .then(() => {
      host.saveConfiguration().then(callback)
    })
    .catch((err) => {
      console.error(err);
    });
  }

  const opts = {
    'dir': grunt.option('appDir'),
    'tmpdir': tmpdir,
    'app-copyright': 'Copyright 2014-2016 Nylas',
    'derefSymlinks': false,
    'asar': {
      'unpack': "{" + [
        '*.node',
        '**/vendor/**',
        'examples/**',
        '**/src/tasks/**',
        '**/node_modules/spellchecker/**',
        '**/node_modules/windows-shortcuts/**',
      ].join(',') + "}",
    },
    'icon': path.resolve(grunt.option('appDir'), 'build', 'resources', 'mac', 'nylas.icns'),
    'ignore': [
      // top level dirs we never want
      '^[\\/]+apm',
      '^[\\/]+arclib',
      '^[\\/]+build',
      '^[\\/]+electron',
      '^[\\/]+flow-typed',
      '^[\\/]+src[\\/]+pro',
      '^[\\/]+spec_integration',

      // general dirs we never want
      '[\\/]+gh-pages$',
      '[\\/]+docs$',
      '[\\/]+obj[\\/]+gen',
      '[\\/]+\\.deps$',

      // specific files we never want
      '\\.DS_Store$',
      '\\.jshintrc$',
      '\\.npmignore$',
      '\\.pairs$',
      '\\.travis\\.yml$',
      'appveyor\\.yml$',
      '\\.idea$',
      '\\.editorconfig$',
      '\\.lint$',
      '\\.lintignore$',
      '\\.arcconfig$',
      '\\.flowconfig$',
      '\\.jshintignore$',
      '\\.gitattributes$',
      '\\.gitkeep$',
      '\\.pdb$',
      '\\.cc$',
      '\\.h$',
      '\\.d\\.ts$',
      '\\.js\\.flow$',
      '\\.map$',
      'binding\\.gyp$',
      'target\\.mk$',
      '\\.node\\.dYSM$',
      'autoconf-\\d*\\.tar\\.gz$',

      // specific (large) module bits we know we don't need
      'node_modules[\\/]+less[\\/]+dist$',
      'node_modules[\\/]+react[\\/]+dist$',
      'node_modules[\\/].*[\\/]tests?$',
      'node_modules[\\/].*[\\/]coverage$',
      'node_modules[\\/].*[\\/]benchmark$',
      '@paulbetts[\\/]+cld[\\/]+deps[\\/]+cld',
    ],
    'out': path.resolve(grunt.option('appDir'), 'dist'),
    'overwrite': true,
    'prune': true,
    'extend-info': path.resolve(grunt.option('appDir'), 'build', 'resources', 'mac', 'nylas-Info.plist'),
    'extra-resource': [
      path.resolve(grunt.option('appDir'), 'build', 'resources', 'mac', 'Nylas Calendar.app'),
    ],

    'afterCopy': [
      runResolveSymlinks,
      runElectronCompile,
    ],
  }

  grunt.registerTask('packager', 'Package build of N1', function pack() {
    const done = this.async()

    console.log('----- Running build with options:');
    console.log(JSON.stringify(opts, null, 2));

    packager(opts, (err, appPaths) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(`Done: ${appPaths}`);
      done();
    });
  });
};
