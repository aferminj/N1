/* eslint global-require:0 */
const fs = require('fs');
const path = require('path');
const _ = require('underscore');

module.exports = (grunt) => {
  const {spawn} = require('./task-helpers')(grunt);

  const appFileName = 'nylas';
  const iconName = 'nylas'
  const outputDir = grunt.config.get('outputDir');
  const contentsDir = path.join(grunt.config('outputDir'), `nylas-linux-${process.arch}`);
  const linuxAssetsDir = path.join('build', 'resources', 'linux');
  const arch = {
    ia32: 'i386',
    x64: 'amd64',
  }[process.arch];

  // a few helpers

  const fillTemplate = (filePath, data, outputPath) => {
    const template = _.template(String(fs.readFileSync(filePath)))
    const finishedPath = outputPath || path.join(outputDir, path.basename(filePath));
    grunt.file.write(finishedPath, template(data));
    return finishedPath;
  }

  const getInstalledSize = (dir, callback) => {
    const cmd = 'du';
    const args = ['-sk', dir];
    spawn({cmd, args}, (error, {stdout}) => {
      const installedSize = stdout.split(/\s+/).shift() || '200000'; // default to 200MB
      callback(null, installedSize);
    });
  }

  grunt.registerTask('create-rpm-installer', 'Create rpm package', function mkrpmf() {
    const done = this.async()
    if (!arch) {
      done(new Error(`Unsupported arch ${process.arch}`));
      return;
    }

    const rpmDir = path.join(grunt.config('outputDir'), 'rpm');
    if (grunt.file.exists(rpmDir)) {
      grunt.file.delete(rpmDir, {force: true});
    }

    const templateData = {
      version: grunt.config('packageJSON').version,
      description: grunt.config('packageJSON').description,
      appName: grunt.config('packageJSON').name,
      name: 'nylas',
      iconName: iconName,
      linuxBinDir: '/usr/local/bin',
      linuxShareDir: '/usr/local/share/nylas',
      appFileName: appFileName,
      contentsDir: contentsDir,
      buildDir: outputDir,
    }

    // This populates nylas.spec
    const specInFilePath = path.join(linuxAssetsDir, 'redhat', 'nylas.spec.in')
    const specOutFilePath = path.join(outputDir, 'nylas.spec')
    fillTemplate(specInFilePath, templateData, specOutFilePath)

    // This populates nylas.desktop
    const desktopInFilePath = path.join(linuxAssetsDir, 'nylas.desktop.in')
    const desktopOutFilePath = path.join(outputDir, 'nylas.desktop')
    fillTemplate(desktopInFilePath, templateData, desktopOutFilePath)

    const cmd = path.join('script', 'mkrpm')
    const args = [specOutFilePath, desktopOutFilePath, outputDir, contentsDir, appFileName]
    spawn({cmd, args}, (error) => {
      if (error) {
        return done(error);
      }
      grunt.log.ok(`Created rpm package in ${rpmDir}`);
      return done();
    });
  });

  grunt.registerTask('create-deb-installer', 'Create debian package', function mkdebf() {
    const done = this.async()
    if (!arch) {
      done(`Unsupported arch ${process.arch}`);
      return;
    }

    const {name, version, description} = grunt.file.readJSON('package.json')
    const section = 'devel'
    const maintainer = 'Nylas Team <support@nylas.com>'
    const installDir = '/usr'

    // NOTE: For Debian packages we use /usr/share instead of /usr/local/share
    const linuxShareDir = path.join(installDir, "share", appFileName)

    getInstalledSize(contentsDir, (error, installedSize) => {
      if (error) {
        done(error);
        return;
      }

      const data = {name, version, description, section, arch, maintainer, installDir, iconName, installedSize, appFileName, linuxShareDir}
      const controlFilePath = fillTemplate(path.join(linuxAssetsDir, 'debian', 'control.in'), data)
      const desktopFilePath = fillTemplate(path.join(linuxAssetsDir, 'nylas.desktop.in'), data)
      const icon = path.join('build', 'resources', 'nylas.png')

      const cmd = path.join('script', 'mkdeb');
      const args = [version, arch, controlFilePath, desktopFilePath, icon, path.join(linuxAssetsDir), contentsDir, outputDir];
      spawn({cmd, args}, (spawnError) => {
        if (spawnError) {
          return done(spawnError);
        }
        grunt.log.ok(`Created ${outputDir}/nylas-${version}-${arch}.deb`);
        return done()
      });
    });
  });
}
