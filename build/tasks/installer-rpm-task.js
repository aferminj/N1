/* eslint global-require:0 */
const path = require('path');

module.exports = (grunt) => {
  const {spawn, fillTemplate} = require('./task-helpers')(grunt)

  grunt.registerTask('mkrpm', 'Create rpm package', function mkrpmf() {
    const done = this.async()
    const arch = {
      ia32: 'i386',
      x64: 'amd64',
    }[process.arch];

    if (!arch) {
      done(new Error(`Unsupported arch ${process.arch}`));
      return;
    }

    const rpmDir = path.join(grunt.config('outputDir'), 'rpm');
    if (grunt.file.exists(rpmDir)) {
      grunt.file.delete(rpmDir, {force: true});
    }

    const buildDir = grunt.config('outputDir');
    const contentsDir = path.join(grunt.config('outputDir'), 'nylas-linux-x64');
    const appFileName = 'nylas';

    const templateData = {
      version: grunt.config('packageJSON').version,
      description: grunt.config('packageJSON').description,
      appName: grunt.config('packageJSON').name,
      name: 'nylas',
      iconName: 'nylas',
      linuxBinDir: '/usr/local/bin',
      linuxShareDir: '/usr/local/share/nylas',
      appFileName: appFileName,
      contentsDir: contentsDir,
      buildDir: buildDir,
    }

    const linuxResourcesPath = path.join('build', 'resources', 'linux')

    // This populates nylas.spec
    const specInFilePath = path.join(linuxResourcesPath, 'redhat', 'nylas.spec.in')
    const specOutFilePath = path.join(buildDir, 'nylas.spec')
    fillTemplate(specInFilePath, specOutFilePath, templateData)

    // This populates nylas.desktop
    const desktopInFilePath = path.join(linuxResourcesPath, 'nylas.desktop.in')
    const desktopOutFilePath = path.join(buildDir, 'nylas.desktop')
    fillTemplate(desktopInFilePath, desktopOutFilePath, templateData)

    const cmd = path.join('script', 'mkrpm')
    const args = [specOutFilePath, desktopOutFilePath, buildDir, contentsDir, appFileName]
    spawn({cmd, args}, (error) => {
      if (error) {
        return done(error);
      }
      grunt.log.ok(`Created rpm package in ${rpmDir}`);
      return done();
    });
  });
}
