var gulp = require('gulp');
var ghPages = require('gulp-gh-pages');
var exec = require('child_process').exec;

gulp.task('deploy', function () {
  return gulp.src('./site/**/*')
    .pipe(ghPages());
});

gulp.task('build-parser', function (done) {
  exec('./node_modules/pegjs/bin/pegjs -e "window.Alligata.parser" ' +
    './lib/circuit-compiler/parser.pegjs ./site/parser.js', function (err) {
    if (err) return done(err);
    done();
  });
});

gulp.task('build-compiler', function (done) {
  exec('coffee -o ./site/ lib/circuit-compiler/compiler.coffee', function (err) {
    if (err) return done(err);
    done();
  });
});

gulp.task('build', ['build-compiler', 'build-parser'], function () {});
