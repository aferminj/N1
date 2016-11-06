
/* eslint prefer-template: 0 */
/* eslint quote-props: 0 */
const fs = require("fs");
const archiver = require('archiver');
const path = require('path');

module.exports = (grunt) => {
  grunt.registerTask('create-mac-installer', 'Zip up N1', function pack() {
    const done = this.async();
    const archive = archiver.create('zip', {});

    const folderPath = path.join(grunt.config('appDir'), 'Nylas N1-darwin-x64', 'Nylas N1.app');
    const outputPath = path.join(grunt.config('appDir'), 'Nylas N1.zip');

    const stream = fs.createWriteStream(outputPath);
    stream.on('end', () => {
      done(null);
    });
    archive.on('error', (err) => {
      done(new Error(err));
    });
    archive.pipe(stream);
    archive.directory(folderPath, false);
    archive.finalize();
  });
};
