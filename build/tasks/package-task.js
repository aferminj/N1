/* eslint prefer-template: 0 */
/* eslint quote-props: 0 */
const packager = require('electron-packager');
const path = require('path');
const tmpdir = path.resolve(require('os').tmpdir(), 'nylas-build');
const fs = require('fs-plus');
const compile = require('electron-compile');

module.exports = (grunt) => {
  function runCopyAPM(buildPath, electronVersion, platform, arch, callback) {
    // Move APM up out of the /app folder which will be inside the ASAR
    const apmTargetDir = path.resolve(buildPath, '..', 'apm');
    fs.moveSync(path.join(buildPath, 'apm'), apmTargetDir)

    // Move /apm/node_modules/atom-package-manager up a level. We're essentially
    // pulling the atom-package-manager module up outside of the node_modules folder,
    // which is necessary because npmV3 installs nested dependencies in the same dir.
    const apmPackageDir = path.join(apmTargetDir, 'node_modules', 'atom-package-manager')
    for (const name of fs.readdirSync(apmPackageDir)) {
      fs.renameSync(path.join(apmPackageDir, name), path.join(apmTargetDir, name));
    }

    const apmSymlink = path.join(apmTargetDir, 'node_modules', '.bin', 'apm');
    if (fs.existsSync(apmSymlink)) {
      fs.unlinkSync(apmSymlink);
    }
    fs.rmdirSync(apmPackageDir);
    callback();
  }

  function runCopyPlatformSpecificResources(buildPath, electronVersion, platform, arch, callback) {
    // these files (like nylas-mailto-default.reg) go alongside the ASAR, not inside it,
    // so we need to move out of the `app` directory.
    const resourcesDir = path.resolve(buildPath, '..');
    if (platform === 'win32') {
      fs.copySync(path.resolve(grunt.config('appDir'), 'build', 'resources', 'win'), resourcesDir);
    }
    callback();
  }

  function runCopySymlinkedPackages(buildPath, electronVersion, platform, arch, callback) {
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

  const platform = grunt.option('platform');

  grunt.config.merge({
    'packager': {
      'platform': platform,
      'dir': grunt.config('appDir'),
      'tmpdir': tmpdir,
      'arch': {
        'win32': 'ia32',
      }[platform],
      'icon': {
        darwin: path.resolve(grunt.config('appDir'), 'build', 'resources', 'mac', 'nylas.icns'),
        win32: path.resolve(grunt.config('appDir'), 'build', 'resources', 'win', 'nylas.ico'),
        linux: undefined,
      }[platform],
      'name': {
        darwin: 'Nylas N1',
        win32: 'nylas',
        linux: 'nylas',
      }[platform],
      'app-copyright': `Copyright (C) 2014-${new Date().getFullYear()} Nylas, Inc. All rights reserved.`,
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
      'ignore': [
        // top level dirs we never want
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
      'out': grunt.config('outputDir'),
      'overwrite': true,
      'prune': true,
      'osx-sign': {
        identity: 'Developer ID Application: InboxApp, Inc. (L6VLD5R29R)',
      },
      'win32metadata': {
        CompanyName: 'Nylas, Inc.',
        FileDescription: 'The best email app for people and teams at work',
        LegalCopyright: `Copyright (C) 2014-${new Date().getFullYear()} Nylas, Inc. All rights reserved.`,
        ProductName: 'Nylas N1',
      },
      'extend-info': path.resolve(grunt.config('appDir'), 'build', 'resources', 'mac', 'nylas-Info.plist'),
      'extra-resource': [
        path.resolve(grunt.config('appDir'), 'build', 'resources', 'mac', 'Nylas Calendar.app'),
      ],
      'afterCopy': [
        runCopyPlatformSpecificResources,
        runCopyAPM,
        runCopySymlinkedPackages,
        runElectronCompile,
      ],
    },
  })

  grunt.registerTask('packager', 'Package build of N1', function pack() {
    const done = this.async()

    console.log('----- Running build with options:');
    console.log(JSON.stringify(grunt.config.get('packager'), null, 2));

    packager(grunt.config.get('packager'), (err, appPaths) => {
      if (err) {
        console.error(err);
        return;
      }
      console.log(`Done: ${appPaths}`);
      done();
    });
  });
};
