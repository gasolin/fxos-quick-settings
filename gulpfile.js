var gulp = require('gulp');
var zip = require('gulp-zip');

gulp.task('default', function() {
  return gulp.src(['index.js', 'manifest.json', 'LICENSE.md', '**/icons/*'])
    .pipe(zip('package.zip'))
    .pipe(gulp.dest('./'));
});
